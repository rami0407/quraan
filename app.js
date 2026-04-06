/**
 * app.js - منطق تطبيق القرآن الكريم
 */

const app = {
    // حالة التطبيق (State)
    state: {
        currentUser: null, // المستخدم الحالي في فايربيس
        userName: '', // اسم العرض
        currentPage: 'home', // home, quran, khatmah, community
        quranPage: 1, // الصفحة الحالية في المصحف (1-604)
        surahs: [], // قائمة السور
        dailyProgress: {
            readPages: 0,
            targetPages: 20
        },
        bookmarkedSurah: null,
        bookmarkedAyah: null
    },

    // تهيئة التطبيق بمجرد التحميل
    init() {
        this.setupNavigation();
        this.updateDate();
        this.settings.init();
        this.reader.init();
        this.hifz.init();
        
        // تهيئة المصادقة مع فايربيس
        this.initAuth();
    },

    // تهيئة نظام الحسابات من فايربيس
    initAuth() {
        if (typeof auth !== 'undefined') {
            auth.onAuthStateChanged(user => {
                if (user) {
                    this.state.currentUser = user;
                    console.log("تم تسجيل الدخول بنجاح. معرف المستخدم:", user.uid);
                    
                    // التحقق من اسم المستخدم
                    db.ref('users/' + user.uid + '/name').once('value').then(snap => {
                        if (snap.exists() && snap.val()) {
                            this.state.userName = snap.val();
                            this.loadProgress();
                        } else {
                            // إجبار المستخدم على إدخال اسمه
                            document.getElementById('name-modal').style.display = 'flex';
                        }
                    });
                } else {
                    // إذا لم يسجل دخوله من قبل، ننشئ حساباً مجهولاً تلقائياً
                    auth.signInAnonymously().catch(error => {
                        console.error("خطأ في تسجيل الدخول:", error);
                        this.loadProgress(true); // الخيار الاحتياطي في حال فشل فايربيس
                    });
                }
            });
        } else {
            this.loadProgress(true);
        }
    },

    // دالة حفظ الاسم
    saveUserName() {
        const input = document.getElementById('user-name-input').value.trim();
        if(!input) return alert("الرجاء كتابة اسمك");
        
        this.state.userName = input;
        if(this.state.currentUser) {
            db.ref('users/' + this.state.currentUser.uid + '/name').set(input)
                .then(() => {
                    document.getElementById('name-modal').style.display = 'none';
                    this.loadProgress();
                });
        }
    },

    // إعداد التنقل الجانبي
    setupNavigation() {
        const links = document.querySelectorAll('.nav-links li');
        links.forEach(link => {
            link.addEventListener('click', () => {
                // تفعيل الرابط
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                // تغيير الصفحة
                const pageId = link.getAttribute('data-page');
                this.navigateTo(pageId);
            });
        });
    },

    // دالة التنقل بين الصفحات
    navigateTo(pageId) {
        // إغلاق القائمة الجانبية في الهاتف (إن كانت مفتوحة)
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('mobile-sidebar-overlay');
        if(sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            if(overlay) overlay.style.display = 'none';
        }

        if (!['home', 'quran', 'khatmah', 'community', 'hifz'].includes(pageId)) {
            alert('عذراً، هذه الميزة قيد التطوير وستتوفر قريباً!');
            return;
        }

        const sections = document.querySelectorAll('.page-section');
        sections.forEach(sec => sec.classList.remove('active'));
        
        const targetSection = document.getElementById(`page-${pageId}`);
        if(targetSection) {
            targetSection.classList.add('active');
            
            document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
            const nLink = document.querySelector(`.nav-links li[data-page="${pageId}"]`);
            if(nLink) nLink.classList.add('active');
        }

        this.state.currentPage = pageId;

        // تهيئة صفحات معينة عند الدخول
        if (pageId === 'quran' && !this.reader.isLoaded) {
            const startSurah = (this.state.quranPage > 114) ? 1 : (this.state.quranPage || 1);
            this.reader.loadSurah(startSurah);
        } else if (pageId === 'khatmah') {
            this.khatmah.init();
        } else if (pageId === 'community') {
            this.community.init();
        }
    },

    // تحديث التاريخ الهجري (بشكل مبسط)
    updateDate() {
        const dateElement = document.getElementById('hijri-date');
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', numberingSystem: 'arab' };
        const date = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', options).format(new Date());
        if(dateElement) dateElement.innerHTML = `<i class="ri-calendar-event-line"></i><span>${date}</span>`;
    },

    // تحميل وتحديث شريط التقدم اليومي من التخزين السحابي أولاً
    async loadProgress(offlineFallback = false) {
        if (offlineFallback || !this.state.currentUser || typeof db === 'undefined') {
            // الخيار الاحتياطي للتخزين المحلي
            const saved = localStorage.getItem('quran_progress');
            if (saved) {
                const data = JSON.parse(saved);
                this.state.quranPage = data.lastPage || 1;
                this.state.dailyProgress.readPages = data.readPages || 0;
                if(data.bookmarkedSurah) {
                    this.state.bookmarkedSurah = data.bookmarkedSurah;
                    this.state.bookmarkedAyah = data.bookmarkedAyah;
                    const btn = document.getElementById('jump-bookmark-btn');
                    if (btn) btn.style.display = 'inline-flex';
                }
            }
            this.updateProgressBar();
            return;
        }

        try {
            // جلب بيانات تقدم المستخدم من فايربيس (Realtime Database)
            const snapshot = await db.ref('users/' + this.state.currentUser.uid).once('value');
            if (snapshot.exists()) {
                const data = snapshot.val();
                this.state.quranPage = data.lastPage || 1;
                this.state.dailyProgress.readPages = data.readPages || 0;
                if(data.bookmarkedSurah) {
                    this.state.bookmarkedSurah = data.bookmarkedSurah;
                    this.state.bookmarkedAyah = data.bookmarkedAyah;
                    const btn = document.getElementById('jump-bookmark-btn');
                    if(btn) btn.style.display = 'inline-flex';
                }
            } else {
                // جلب من localStorage كبديل مبدئي عند أول تسجيل دخول لعدم فقدان تقدمه السابق
                const saved = localStorage.getItem('quran_progress');
                if (saved) {
                    const data = JSON.parse(saved);
                    this.state.quranPage = data.lastPage || 1;
                    this.state.dailyProgress.readPages = data.readPages || 0;
                    if(data.bookmarkedSurah) {
                        this.state.bookmarkedSurah = data.bookmarkedSurah;
                        this.state.bookmarkedAyah = data.bookmarkedAyah;
                        const btn = document.getElementById('jump-bookmark-btn');
                        if (btn) btn.style.display = 'inline-flex';
                    }
                }
            }
        } catch (error) {
            console.error("خطأ في جلب البيانات من فايربيس:", error);
        }

        this.updateProgressBar();
    },

    updateProgressBar() {
        const percent = Math.min(100, Math.round((this.state.dailyProgress.readPages / this.state.dailyProgress.targetPages) * 100));
        document.getElementById('progress-percent').innerText = `${percent}%`;
        document.getElementById('daily-progress-bar').style.width = `${percent}%`;
    },

    saveProgress(pageRead) {
        // تحديث عدد الصفحات المقروءة للورد
        this.state.dailyProgress.readPages += 1;
        this.updateProgressBar();

        const progressData = {
            lastPage: pageRead,
            readPages: this.state.dailyProgress.readPages,
            date: new Date().toDateString()
        };

        // الحفظ المحلي احتياطياً
        localStorage.setItem('quran_progress', JSON.stringify(progressData));

        // الحفظ السحابي في فايربيس
        if (this.state.currentUser && typeof db !== 'undefined') {
            // إضافة وقت السيرفر لمعرفة توقيت الحفظ الدقيق
            progressData.timestamp = firebase.database.ServerValue.TIMESTAMP;
            db.ref('users/' + this.state.currentUser.uid).update(progressData)
                .catch(error => console.error('خطأ في حفظ التقدم في فايربيس:', error));
        }
    },

    // دالة مشاركة الإنجاز عبر الواتساب
    shareToWhatsApp() {
        const pct = Math.min(100, Math.round((this.state.dailyProgress.readPages / this.state.dailyProgress.targetPages) * 100));
        const text = `السلام عليكم 🌙\nلقد أتممت ${pct}% من وردي اليومي من القرآن الكريم في تطبيق ختمة.\nلا تنس وردك! 📖✨`;
        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    },

    // ==========================================
    // وحدة الإعدادات (Settings Module)
    // ==========================================
    settings: {
        fontSize: 2.2, // rem
        theme: 'dark', // dark, sepia
        
        init() {
            const saved = localStorage.getItem('quran_settings');
            if (saved) {
                const data = JSON.parse(saved);
                this.fontSize = data.fontSize || 2.2;
                this.theme = data.theme || 'dark';
            }
            this.applySettings();
        },
        
        toggleTheme() {
            this.theme = this.theme === 'dark' ? 'sepia' : 'dark';
            this.applySettings();
            this.save();
        },
        
        applySettings() {
            document.documentElement.style.setProperty('--font-size-base', `${this.fontSize}rem`);
            if (this.theme === 'sepia') {
                document.body.classList.add('theme-sepia');
            } else {
                document.body.classList.remove('theme-sepia');
            }
        },
        
        save() {
            localStorage.setItem('quran_settings', JSON.stringify({
                fontSize: this.fontSize,
                theme: this.theme
            }));
        }
    },

    // ==========================================
    // وحدة قارئ القرآن (Reader Module)
    // ==========================================
    reader: {
        isLoaded: false,
        currentSurahNumber: 1,
        observer: null,
        endObserver: null,
        
        init() {
            this.fetchSurahs();
            // إعداد مستمع اختيار السورة
            document.getElementById('surah-select').addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadSurah(parseInt(e.target.value));
                }
            });
            this.setupObserver();
        },
        
        setupObserver() {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const pageNum = entry.target.getAttribute('data-page');
                        if (pageNum && !entry.target.hasAttribute('data-tracked')) {
                            // زيادة تقدم الورد اليومي
                            app.saveProgress(app.state.quranPage || 1);
                            entry.target.setAttribute('data-tracked', 'true');
                            // تأثير بصري خفيف للتأكيد
                            entry.target.style.color = 'var(--gold-primary)';
                            entry.target.style.borderBottomColor = 'var(--gold-primary)';
                        }
                    }
                });
            }, { root: null, rootMargin: '0px', threshold: 0.5 });
            
            // Intersection Observer للمراقبة من أجل التمرير اللانهائي
            this.endObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const sNum = parseInt(entry.target.getAttribute('data-surah'));
                        if (sNum < 114) {
                            app.reader.loadSurah(sNum + 1, true); // append true
                            this.endObserver.unobserve(entry.target);
                        }
                    }
                });
            }, { root: null, rootMargin: '400px', threshold: 0.1 }); // margin كبير ليبدأ التحميل قبل الوصول تماماً
        },

        // جلب قائمة السور لوضعها في القائمة المنسدلة
        async fetchSurahs() {
            try {
                const res = await fetch('https://api.alquran.cloud/v1/meta');
                const data = await res.json();
                app.state.surahs = data.data.surahs.references;
                
                const select = document.getElementById('surah-select');
                select.innerHTML = '';
                
                app.state.surahs.forEach(surah => {
                    const option = document.createElement('option');
                    option.value = surah.number;
                    option.textContent = `سورة ${surah.name}`;
                    select.appendChild(option);
                });
            } catch (err) {
                console.error("خطأ في جلب بيانات السور:", err);
            }
        },

        async loadSurah(surahNumber, append = false) {
            if (surahNumber < 1 || surahNumber > 114) return;
            
            if (!append) {
                this.currentSurahNumber = surahNumber;
                app.state.quranPage = surahNumber; // نحتفظ برقم السورة هنا بدلاً من الصفحة كمرجع
            }
            this.isLoaded = true;
            
            const contentDiv = document.getElementById('quran-page-content');
            
            if (!append) {
                contentDiv.innerHTML = '<div class="loading-spinner"></div>';
            } else {
                contentDiv.insertAdjacentHTML('beforeend', '<div class="loading-spinner append-spinner"></div>');
            }
            
            document.getElementById('current-page-display').textContent = `جاري التحميل...`;
            
            const actionsDiv = document.getElementById('quran-reader-actions');
            if(actionsDiv) actionsDiv.style.display = 'none';

            try {
                const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/quran-uthmani`);
                const data = await res.json();
                const ayahs = data.data.ayahs;
                const surahName = data.data.name;
                
                document.getElementById('current-page-display').textContent = `سورة ${surahName}`;

                const selectElement = document.getElementById('surah-select');
                if (selectElement) selectElement.value = surahNumber;

                let html = '';
                let currentPage = null;
                let currentJuz = null;

                html += `<div class="surah-header">سُورَةُ ${surahName}</div>`;
                if (surahNumber !== 9 && surahNumber !== 1) {
                    html += `<span class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>`;
                }

                ayahs.forEach((ayah) => {
                    // فحص تغير الجزء
                    if (ayah.juz !== currentJuz) {
                        if (currentJuz !== null || ayah.numberInSurah === 1) {
                            html += `<div class="juz-marker">بِدايَةُ الجُزْءِ ${this.toArabicNumbers(ayah.juz)}</div>`;
                        }
                        currentJuz = ayah.juz;
                    }

                    // فحص تغير الصفحة
                    if (ayah.page !== currentPage) {
                        if (currentPage !== null) {
                            html += `<div class="page-marker" data-page="${currentPage}">نهاية الصفحة ${this.toArabicNumbers(currentPage)}</div>`;
                        }
                        currentPage = ayah.page;
                    }

                    let text = ayah.text;
                    if (ayah.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9) {
                        text = text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '').trim();
                    }

                    const words = text.split(' ');
                    html += `<span id="ayah-txt-${surahNumber}-${ayah.numberInSurah}" class="ayah-wrap" onclick="app.hifz.handleAyahClick(${surahNumber}, ${ayah.numberInSurah})">`;
                    words.forEach(word => {
                        html += `<span class="quran-word">${word}</span>`;
                    });

                    const isActiveBookmark = (app.state.bookmarkedSurah === surahNumber && app.state.bookmarkedAyah === ayah.numberInSurah) ? 'active' : '';
                    html += `<span class="ayah-end"><span>${this.toArabicNumbers(ayah.numberInSurah)}</span></span>`;
                    html += `<button class="ayah-bookmark ${isActiveBookmark}" id="bookmark-${surahNumber}-${ayah.numberInSurah}" onclick="app.reader.toggleBookmark(${surahNumber}, ${ayah.numberInSurah})" title="حفظ كعلامة"><i class="ri-bookmark-fill"></i></button>`;
                    html += `</span>`;
                });

                if (currentPage !== null) {
                     html += `<div class="page-marker" data-page="${currentPage}">نهاية الصفحة ${this.toArabicNumbers(currentPage)}</div>`;
                }

                html += `<div class="surah-end-marker" data-surah="${surahNumber}" style="height: 1px; width: 100%;"></div>`;

                if (!append) {
                    contentDiv.innerHTML = `<div class="p-4" style="text-align: justify; direction: rtl;">${html}</div>`;
                } else {
                    const spinners = document.querySelectorAll('.append-spinner');
                    spinners.forEach(s => s.remove());
                    contentDiv.insertAdjacentHTML('beforeend', `<div class="p-4" style="text-align: justify; direction: rtl;">${html}</div>`);
                }
                
                // تطبيق تلوين الحفظ على الواجهة المبنية للتو
                app.hifz.applyAllColors();
                
                // تفعيل المراقبة للتقاطع وللتمرير
                document.querySelectorAll('.page-marker').forEach(marker => {
                    this.observer.observe(marker);
                });
                
                const endMarkers = document.querySelectorAll(`.surah-end-marker[data-surah="${surahNumber}"]`);
                if(endMarkers.length > 0) {
                    this.endObserver.observe(endMarkers[endMarkers.length - 1]);
                }

                if (actionsDiv) {
                    actionsDiv.style.display = 'none'; // الاستغناء عنه للتمرير اللانهائي
                }

            } catch (err) {
                console.error("خطأ في جلب الآيات:", err);
                contentDiv.innerHTML = '<p style="text-align:center; color: red;">حدث خطأ في جلب بيانات السورة.</p>';
            }
        },

        async loadJuz(juzNumber, targetKhatmahId = null) {
            if (juzNumber < 1 || juzNumber > 30) return;
            
            this.isLoaded = true;
            
            const contentDiv = document.getElementById('quran-page-content');
            contentDiv.innerHTML = '<div class="loading-spinner"></div>';
            
            document.getElementById('current-page-display').textContent = `جاري التحميل...`;
            
            const actionsDiv = document.getElementById('quran-reader-actions');
            if(actionsDiv) actionsDiv.style.display = 'none';

            try {
                const res = await fetch(`https://api.alquran.cloud/v1/juz/${juzNumber}/quran-uthmani`);
                const data = await res.json();
                const ayahs = data.data.ayahs;
                
                document.getElementById('current-page-display').textContent = `الجزء ${juzNumber}`;

                let html = '';
                let currentPage = null;
                let currentSurahName = null;

                html += `<div class="juz-marker" style="margin-bottom: 20px; text-align: center; font-size: 1.5rem; color: var(--gold-primary);">بِدايَةُ الجُزْءِ ${this.toArabicNumbers(juzNumber)}</div>`;

                ayahs.forEach((ayah) => {
                    const surahName = ayah.surah.name;
                    const surahNumber = ayah.surah.number;
                    
                    if (surahName !== currentSurahName) {
                        html += `<div class="surah-header">سُورَةُ ${surahName}</div>`;
                        if (surahNumber !== 9 && surahNumber !== 1 && ayah.numberInSurah === 1) { 
                            html += `<span class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>`;
                        } else if (surahNumber !== 9 && surahNumber !== 1 && currentSurahName !== null && ayah.numberInSurah === 1) {
                            html += `<span class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>`;
                        }
                        currentSurahName = surahName;
                    }

                    if (ayah.page !== currentPage) {
                        if (currentPage !== null) {
                            html += `<div class="page-marker" data-page="${currentPage}">نهاية الصفحة ${this.toArabicNumbers(currentPage)}</div>`;
                        }
                        currentPage = ayah.page;
                    }

                    let text = ayah.text;
                    if (ayah.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9) {
                        text = text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '').trim();
                    }

                    const words = text.split(' ');
                    html += `<span id="ayah-txt-${surahNumber}-${ayah.numberInSurah}" class="ayah-wrap" onclick="app.hifz.handleAyahClick(${surahNumber}, ${ayah.numberInSurah})">`;
                    words.forEach(word => {
                        html += `<span class="quran-word">${word}</span>`;
                    });

                    const isActiveBookmark = (app.state.bookmarkedSurah === surahNumber && app.state.bookmarkedAyah === ayah.numberInSurah) ? 'active' : '';
                    html += `<span class="ayah-end"><span>${this.toArabicNumbers(ayah.numberInSurah)}</span></span>`;
                    html += `<button class="ayah-bookmark ${isActiveBookmark}" id="bookmark-${surahNumber}-${ayah.numberInSurah}" onclick="app.reader.toggleBookmark(${surahNumber}, ${ayah.numberInSurah})" title="حفظ كعلامة"><i class="ri-bookmark-fill"></i></button>`;
                    html += `</span>`;
                });

                if (currentPage !== null) {
                     html += `<div class="page-marker" data-page="${currentPage}">نهاية الصفحة ${this.toArabicNumbers(currentPage)}</div>`;
                }

                html += `<div class="juz-end-marker" data-juz="${juzNumber}" data-khatmah="${targetKhatmahId || ''}" style="margin: 40px auto; padding: 30px; background: rgba(46, 204, 113, 0.1); border: 2px dashed #2ecc71; border-radius: 12px; text-align: center;">
                            <h3 style="color: #2ecc71; margin-bottom: 10px;"><i class="ri-check-double-line"></i> صدق الله العظيم</h3>
                            <p style="color: var(--text-secondary);">لقد أتممت بفضل الله الجزء ${this.toArabicNumbers(juzNumber)}</p>
                        </div>`;

                contentDiv.innerHTML = `<div class="p-4" style="text-align: justify; direction: rtl;">${html}</div>`;
                
                app.hifz.applyAllColors();
                
                document.querySelectorAll('.page-marker').forEach(marker => {
                    this.observer.observe(marker);
                });
                
                const endJuzMarker = contentDiv.querySelector('.juz-end-marker');
                if(endJuzMarker) {
                    const juzObserver = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting && !entry.target.hasAttribute('data-tracked')) {
                                entry.target.setAttribute('data-tracked', 'true');
                                entry.target.style.background = 'rgba(46, 204, 113, 0.3)';
                                entry.target.style.borderStyle = 'solid';
                                
                                const khatmahId = entry.target.getAttribute('data-khatmah');
                                const jNumber = parseInt(entry.target.getAttribute('data-juz'));
                                
                                if (khatmahId && khatmahId.trim() !== '' && khatmahId !== 'null') {
                                    app.khatmah.selectedMonthlyDay = jNumber;
                                    app.khatmah.currentKhatmahId = khatmahId;
                                    app.khatmah.setMonthlyProgress('full');
                                }
                            }
                        });
                    }, { root: null, rootMargin: '0px', threshold: 0.5 });
                    juzObserver.observe(endJuzMarker);
                }

                if (actionsDiv) {
                    actionsDiv.style.display = 'none';
                }
                
                const container = document.querySelector('.main-content');
                if(container) container.scrollTo({ top: 0, behavior: 'smooth' });
                window.scrollTo({ top: 0, behavior: 'smooth' });

            } catch (err) {
                console.error("خطأ في جلب الجزء:", err);
                contentDiv.innerHTML = '<div style="text-align: center; color: red;">حدث خطأ أثناء تحميل الجزء.</div>';
            }
        },

        nextSurah() {
            if (this.currentSurahNumber < 114) {
                const next = this.currentSurahNumber + 1;
                this.loadSurah(next);
                // العودة للأعلى
                const container = document.querySelector('.main-content');
                if(container) container.scrollTo({ top: 0, behavior: 'smooth' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        },

        changeFontSize(direction) {
            app.settings.fontSize += (direction * 0.2);
            if(app.settings.fontSize < 1.0) app.settings.fontSize = 1.0;
            if(app.settings.fontSize > 4.5) app.settings.fontSize = 4.5;
            app.settings.applySettings();
            app.settings.save();
        },

        toggleBookmark(surahNum, ayahNum) {
            const prev = document.querySelector('.ayah-bookmark.active');
            if (prev) prev.classList.remove('active');
            
            const current = document.getElementById(`bookmark-${surahNum}-${ayahNum}`);
            if (current) current.classList.add('active');
            
            app.state.bookmarkedSurah = surahNum;
            app.state.bookmarkedAyah = ayahNum;
            
            const btn = document.getElementById('jump-bookmark-btn');
            if (btn) btn.style.display = 'inline-flex';
            
            // حفظ المحفوظات
            const saved = localStorage.getItem('quran_progress');
            let progressData = saved ? JSON.parse(saved) : {};
            progressData.bookmarkedSurah = surahNum;
            progressData.bookmarkedAyah = ayahNum;
            localStorage.setItem('quran_progress', JSON.stringify(progressData));
            
            if (app.state.currentUser && typeof db !== 'undefined') {
                db.ref('users/' + app.state.currentUser.uid).update({
                    bookmarkedSurah: surahNum,
                    bookmarkedAyah: ayahNum
                });
            }
        },

        async jumpToBookmark() {
            const bSurah = app.state.bookmarkedSurah;
            const bAyah = app.state.bookmarkedAyah;
            if(!bSurah) return;
            
            if (this.currentSurahNumber !== bSurah) {
                await this.loadSurah(bSurah);
            }
            
            const target = document.getElementById(`ayah-txt-${bSurah}-${bAyah}`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.style.transition = "background 0.5s ease";
                target.style.background = "var(--gold-dim)";
                setTimeout(() => target.style.background = "transparent", 1500);
            }
        },

        // تحويل الأرقام الإنجليزية إلى عربية
        toArabicNumbers(num) {
            const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
            return num.toString().split('').map(char => arabicNumbers[parseInt(char)]).join('');
        }
    },

    // ==========================================
    // وحدة الختمة الجماعية (Khatmah Module)
    // ==========================================
    khatmah: {
        currentKhatmahId: null,

        init() {
            this.fetchMyKhatmahs();
        },

        showCreateModal(type = 'partitioned') { 
            const select = document.getElementById('khatmah-type-select');
            if (select) select.value = type;
            document.getElementById('create-khatmah-modal').style.display = 'flex'; 
        },
        showJoinModal() { document.getElementById('khatmah-code-input').value=''; document.getElementById('join-khatmah-modal').style.display = 'flex'; },
        closeModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); },

        async fetchMyKhatmahs() {
            if (!app.state.currentUser) return;
            const listDiv = document.getElementById('my-khatmahs-list');
            listDiv.innerHTML = '<div class="loading-spinner"></div>';
            
            // جلب الختمات المرتبطة بالمستخدم (الاستماع للتحديثات)
            db.ref('users/' + app.state.currentUser.uid + '/khatmahs').on('value', snapshot => {
                listDiv.innerHTML = '';
                const khatmahs = snapshot.val();
                if (!khatmahs) {
                    listDiv.innerHTML = '<p style="text-align:center; padding: 20px; color:var(--text-secondary);">لم تنضم لأي ختمة بعد. قم بإنشاء واحدة أو الانضمام لتبدأ!</p>';
                    return;
                }
                
                // جلب تفاصيل كل ختمة وعرضها
                Object.keys(khatmahs).forEach(kid => {
                    db.ref('khatmahs/' + kid).once('value').then(kSnap => {
                        const khatmah = kSnap.val();
                        if(khatmah) {
                            const completedCount = khatmah.ajza ? khatmah.ajza.filter(j => j.status === 'completed').length : 0;
                            const pct = Math.round((completedCount/30)*100);
                            
                            const el = document.createElement('div');
                            el.className = 'khatmah-item glass-panel';
                            el.innerHTML = `
                                <div>
                                    <h3 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:5px;">${app.community.escapeHTML(khatmah.name)}</h3>
                                    <p style="font-size:0.8rem; color:var(--text-secondary);">الأعضاء: ${Object.keys(khatmah.members||{}).length} | نسبة الإنجاز: ${pct}%</p>
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    ${ khatmah.createdBy === app.state.currentUser.uid 
                                        ? `<button class="icon-btn" style="width: 32px; height: 32px; font-size:1rem;" onclick="event.stopPropagation(); app.khatmah.showEditModal('${kid}', '${app.community.escapeHTML(khatmah.name).replace(/'/g, "\\'")}')" title="تعديل الاسم"><i class="ri-edit-line"></i></button>
                                           <button class="icon-btn" style="width: 32px; height: 32px; font-size:1rem; color: #e74c3c;" onclick="event.stopPropagation(); app.khatmah.deleteKhatmah('${kid}')" title="مسح الختمة"><i class="ri-delete-bin-line"></i></button>`
                                        : `<button class="icon-btn" style="width: 32px; height: 32px; font-size:1rem; color: #e74c3c;" onclick="event.stopPropagation(); app.khatmah.leaveKhatmah('${kid}')" title="مغادرة"><i class="ri-logout-box-line"></i></button>`
                                    }
                                    <i class="ri-arrow-left-s-line" style="font-size:1.5rem; color:var(--gold-primary); margin-right: 5px;"></i>
                                </div>
                            `;
                            el.onclick = () => this.openKhatmah(kid);
                            listDiv.appendChild(el);
                        }
                    });
                });
            });
        },

        async create() {
            const name = document.getElementById('khatmah-name-input').value.trim();
            const typeSelect = document.getElementById('khatmah-type-select');
            const type = typeSelect ? typeSelect.value : 'partitioned';
            if(!name) return alert("الرجاء إدخال اسم الختمة.");
            if(!app.state.currentUser || !app.state.userName) return alert("الرجاء تسجيل اسمك للمتابعة.");
            
            let finalName = name;
            if (type === 'monthly') {
                try {
                    const hijriMonth = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { month: 'long' }).format(new Date());
                    finalName = `${name} لشهر ${hijriMonth}`;
                } catch(e) {
                    // Fallback in case of lack of intl support
                }
            }

            const code = Math.random().toString(36).substr(2, 6).toUpperCase();
            
            // تهيئة 30 جزءاً
            const initialAjza = Array.from({length: 30}, (_, i) => ({
                index: i + 1,
                status: 'available',
                ownerUid: null,
                ownerName: null
            }));

            const kData = {
                type: type,
                name: finalName,
                code: code,
                createdBy: app.state.currentUser.uid,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                members: {
                    [app.state.currentUser.uid]: app.state.userName
                },
                ajza: initialAjza
            };

            const kRef = db.ref('khatmahs').push();
            await kRef.set(kData);
            
            // إضافة الربط لملف المستخدم
            await db.ref('users/' + app.state.currentUser.uid + '/khatmahs/' + kRef.key).set(true);
            
            this.closeModals();
            this.openKhatmah(kRef.key);
        },

        async join() {
            const code = document.getElementById('khatmah-code-input').value.trim().toUpperCase();
            if(!code) return alert("الرجاء إدخال رمز الختمة.");
            
            db.ref('khatmahs').orderByChild('code').equalTo(code).once('value', snapshot => {
                if(snapshot.exists()) {
                    const khatmahId = Object.keys(snapshot.val())[0];
                    db.ref('khatmahs/' + khatmahId + '/members/' + app.state.currentUser.uid).set(app.state.userName);
                    db.ref('users/' + app.state.currentUser.uid + '/khatmahs/' + khatmahId).set(true);
                    
                    this.closeModals();
                    this.openKhatmah(khatmahId);
                } else {
                    alert("رمز الختمة غير صحيح أو تم مسحها.");
                }
            });
        },

        backToDashboard() {
            document.getElementById('khatmah-detail').style.display = 'none';
            document.getElementById('khatmah-dashboard').style.display = 'block';
            if (this.currentKhatmahId) {
                db.ref('khatmahs/' + this.currentKhatmahId).off(); // إيقاف الاستماع لمنع التكرار
                this.currentKhatmahId = null;
            }
        },

        copyCode() {
            const codeText = document.getElementById('khatmah-code').innerText;
            navigator.clipboard.writeText(codeText.replace(' ', ''));
            alert('تم نسخ الرمز بنجاح!');
        },

        selectedMonthlyDay: 1,
        currentKhatmahData: null,

        openKhatmah(id) {
            this.currentKhatmahId = id;
            document.getElementById('khatmah-dashboard').style.display = 'none';
            document.getElementById('khatmah-detail').style.display = 'block';
            
            // Set initial selected day to a simple local Hijri day approximation, or 1.
            const today = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {day: 'numeric'}).format(new Date());
            this.selectedMonthlyDay = parseInt(today) || 1;
            
            // استماع فوري للتغييرات في هذه الختمة
            db.ref('khatmahs/' + id).on('value', snapshot => {
                if(!snapshot.exists()) return;
                const data = snapshot.val();
                this.currentKhatmahData = data;
                
                document.getElementById('khatmah-title').innerText = data.name;
                document.getElementById('khatmah-code').innerText = data.code;
                
                if (data.type === 'monthly') {
                    document.getElementById('ajza-grid').style.display = 'none';
                    if (document.getElementById('monthly-days-grid')) document.getElementById('monthly-days-grid').style.display = 'grid';
                    document.querySelector('.khatmah-progress-circle').style.display = 'none';
                    this.renderMonthlyGrid();
                    if (document.getElementById('monthly-day-modal') && document.getElementById('monthly-day-modal').style.display === 'flex') {
                        this.renderMonthlyModalMembers();
                    }
                } else {
                    document.getElementById('ajza-grid').style.display = 'grid';
                    if (document.getElementById('monthly-days-grid')) document.getElementById('monthly-days-grid').style.display = 'none';
                    document.querySelector('.khatmah-progress-circle').style.display = 'block';
                    
                    const ajza = data.ajza || [];
                    const completedCount = ajza.filter(j => j.status === 'completed').length;
                    const pct = Math.round((completedCount/30)*100);
                    
                    document.getElementById('khatmah-progress-text').innerText = `${pct}%`;
                    document.getElementById('khatmah-progress-svg').style.strokeDasharray = `${pct}, 100`;

                    this.renderAjza(ajza);
                }
            });
        },

        renderAjza(ajza) {
            const grid = document.getElementById('ajza-grid');
            if(!grid) return;
            grid.innerHTML = '';

            ajza.forEach((juz, idx) => {
                const el = document.createElement('div');
                el.className = `juz-card ${juz.status}`;
                
                let statusText = "متاح الحجز";
                let iconStr = '<i class="ri-book-open-line"></i>';
                
                if (juz.status === 'claimed') {
                    statusText = `يقرأه: ${juz.ownerName || 'متسخدم'}`;
                    iconStr = '<i class="ri-user-star-line"></i>';
                } else if (juz.status === 'completed') {
                    statusText = `تَمَّت 💚`;
                    iconStr = '<i class="ri-check-double-line"></i>';
                }

                el.innerHTML = `
                    <div class="juz-number">ج ${juz.index}</div>
                    <div style="font-size:1.8rem; margin:5px 0;">${iconStr}</div>
                    <div class="juz-status">${statusText}</div>
                `;

                el.onclick = () => this.handleJuzClick(idx, juz);
                grid.appendChild(el);
            });
        },

        handleJuzClick(idx, juz) {
            if (!this.currentKhatmahId || !app.state.currentUser) return;
            const updateRef = db.ref(`khatmahs/${this.currentKhatmahId}/ajza/${idx}`);
            
            if (juz.status === 'available') {
                if(confirm(`هل تعقد النية على قراءة الجزء ${juz.index}؟`)) {
                    updateRef.update({
                        status: 'claimed',
                        ownerUid: app.state.currentUser.uid,
                        ownerName: app.state.userName
                    });
                }
            } else if (juz.status === 'claimed') {
                // إذا كان هو من حادزه
                if (juz.ownerUid === app.state.currentUser.uid) {
                    if(confirm("هل أتممت قراءة هذا الجزء بفضل الله؟")) {
                        updateRef.update({ status: 'completed' });
                        
                        // إطلاق قصاصات الاحتفال
                        if (typeof window.confetti === 'function') {
                            window.confetti({
                                particleCount: 150,
                                spread: 70,
                                origin: { y: 0.6 },
                                zIndex: 1100, // ليظهر فوق النوافذ
                                colors: ['#C9A84C', '#1B4332', '#ffffff']
                            });
                        }
                    } else if (confirm("هل تريد إلغاء حجزك لهذا الجزء ليقرأه شخص آخر؟")) {
                         updateRef.update({
                            status: 'available',
                            ownerUid: null,
                            ownerName: null
                        });
                    }
                } else {
                    alert(`هذا الجزء محجوز حالياً من قبل ${juz.ownerName || 'عضو آخر'}. اختر جزءاً الأخضر!`);
                }
            } else if (juz.status === 'completed') {
                alert("تم ختم هذا الجزء، تقبل الله منا ومنكم.");
            }
        },

        renderMonthlyGrid() {
            if (!this.currentKhatmahData || this.currentKhatmahData.type !== 'monthly') return;
            const grid = document.getElementById('monthly-days-grid');
            if(!grid) return;
            grid.innerHTML = '';
            
            const members = this.currentKhatmahData.members || {};
            const totalMembers = Object.keys(members).length || 1;
            
            // Extract month name from title or fallback
            let titleMonth = 'الشهر الحالي';
            const nameParts = this.currentKhatmahData.name.split(' لشهر ');
            if (nameParts.length > 1) {
                titleMonth = nameParts[1];
            }
            
            for (let i = 1; i <= 30; i++) {
                const dayStr = i.toString();
                const progressObj = (this.currentKhatmahData.monthly_progress && this.currentKhatmahData.monthly_progress[dayStr]) || {};
                
                let fullCount = 0;
                let isMeCompleted = false;
                
                for(let uid in progressObj) {
                    if (progressObj[uid] === 'full') {
                        fullCount++;
                    }
                    if (uid === app.state.currentUser.uid && progressObj[uid] === 'full') {
                        isMeCompleted = true;
                    }
                }
                
                const pct = Math.min(100, Math.round((fullCount / totalMembers) * 100));
                
                let bgStyle = 'background: rgba(30, 30, 30, 0.6);';
                if (pct > 0) {
                    bgStyle = `background: linear-gradient(to top, rgba(46, 204, 113, 0.4) 0%, rgba(46, 204, 113, 0.4) ${pct}%, rgba(30, 30, 30, 0.6) ${pct}%, rgba(30, 30, 30, 0.6) 100%);`;
                }
                if (pct === 100) {
                    bgStyle = 'background: rgba(46, 204, 113, 0.8); box-shadow: 0 0 10px rgba(46, 204, 113, 0.5); border-color: #2ecc71;';
                }
                
                const el = document.createElement('div');
                el.className = `juz-card monthly-card`;
                el.style = bgStyle + " cursor: pointer; position: relative; transition: all 0.3s ease;";
                
                let meIcon = isMeCompleted ? '<i class="ri-check-line" style="color:var(--gold-primary); position:absolute; top:8px; right:8px; font-size:1.3rem;"></i>' : '';
                
                el.innerHTML = `
                    ${meIcon}
                    <div style="font-size:1.1rem; font-weight:bold; color:var(--text-primary); margin-top:5px;">${i} ${titleMonth}</div>
                    <div style="font-size:1.8rem; margin:10px 0;">
                        ${pct === 100 ? '<i class="ri-check-double-line" style="color:white;"></i>' : '<i class="ri-calendar-event-fill" style="color:var(--gold-dim);"></i>'}
                    </div>
                    <div class="juz-status" style="color: ${pct === 100 ? 'white' : 'var(--text-secondary)'};">الجزء ${i}</div>
                    <div style="font-size:0.8rem; margin-top:8px; color:${pct === 100 ? 'rgba(255,255,255,0.8)' : '#aaa'}; font-weight:bold;">${pct}% مُكتمل</div>
                `;
                
                el.onclick = () => this.openMonthlyDayModal(i);
                grid.appendChild(el);
            }
        },

        openMonthlyDayModal(day) {
            this.selectedMonthlyDay = day;
            document.getElementById('monthly-day-modal').style.display = 'flex';
            document.getElementById('modal-day-title').innerText = `اليوم ${day}`;
            document.getElementById('modal-juz-title').innerText = `المستهدف: الجزء ${day}`;
            this.renderMonthlyModalMembers();
        },

        readJuzForKhatmah() {
            const juzNumber = this.selectedMonthlyDay;
            const khatmahId = this.currentKhatmahId;
            this.closeModals();
            app.navigateTo('quran');
            app.reader.loadJuz(juzNumber, khatmahId);
        },

        renderMonthlyModalMembers() {
            if (!this.currentKhatmahData || this.currentKhatmahData.type !== 'monthly') return;
            
            const dayStr = this.selectedMonthlyDay;
            const listDiv = document.getElementById('monthly-modal-members-list');
            if(!listDiv) return;
            listDiv.innerHTML = '';
            
            const members = this.currentKhatmahData.members || {};
            const progress = (this.currentKhatmahData.monthly_progress && this.currentKhatmahData.monthly_progress[dayStr]) || {};
            
            let html = '';
            for (let uid in members) {
                const name = members[uid];
                const status = progress[uid] || 'none';
                
                let icon = '<i class="ri-checkbox-blank-circle-line" style="color:var(--text-secondary);"></i>';
                let text = '<span style="color:var(--text-secondary);">لم يقرأ بعد</span>';
                if (status === 'full') {
                    icon = '<i class="ri-check-double-line" style="color:#2ecc71;"></i>';
                    text = '<span style="color:#2ecc71;">أتمّ الجزء كاملًا 🌟</span>';
                } else if (status === 'half') {
                    icon = '<i class="ri-check-line" style="color:#f1c40f;"></i>';
                    text = '<span style="color:#f1c40f;">قرأ بعضًا منه 📚</span>';
                }
                
                const isMe = uid === app.state.currentUser.uid;
                
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: ${isMe ? 'var(--gold-primary)' : 'var(--text-primary)'}; font-weight: ${isMe ? 'bold' : 'normal'};">
                            ${app.community.escapeHTML(name)} ${isMe ? '(أنت)' : ''}
                        </span>
                        <span style="font-size: 0.95rem; display: flex; align-items: center; gap: 5px;">
                            ${text} ${icon}
                        </span>
                    </div>
                `;
            }
            listDiv.innerHTML = html;
        },

        async setMonthlyProgress(status) {
            if (!this.currentKhatmahId) return;
            const uid = app.state.currentUser.uid;
            const dayStr = this.selectedMonthlyDay;
            
            try {
                if (status === 'none') {
                    await db.ref(`khatmahs/${this.currentKhatmahId}/monthly_progress/${dayStr}/${uid}`).remove();
                } else {
                    await db.ref(`khatmahs/${this.currentKhatmahId}/monthly_progress/${dayStr}/${uid}`).set(status);
                    if (status === 'full' && typeof window.confetti === 'function') {
                        window.confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 }, zIndex: 1100, colors: ['#2ecc71', '#f1c40f', '#ffffff'] });
                    }
                }
            } catch (err) {
                console.error(err);
                alert('حدث خطأ أثناء حفظ الإنجاز = ' + err.message);
            }
        },

        editingKhatmahId: null,

        showEditModal(kid, currentName) {
            this.editingKhatmahId = kid;
            document.getElementById('edit-khatmah-name-input').value = currentName;
            document.getElementById('edit-khatmah-modal').style.display = 'flex';
        },

        async saveEditKhatmah() {
            const newName = document.getElementById('edit-khatmah-name-input').value.trim();
            if (!newName) return alert('الرجاء إدخال اسم للختمة');
            if (this.editingKhatmahId) {
                await db.ref('khatmahs/' + this.editingKhatmahId + '/name').set(newName);
            }
            this.closeModals();
        },

        async deleteKhatmah(kid) {
            if (confirm('هل أنت متأكد من مسح الختمة بالكامل لجميع الأعضاء؟ لا يمكن التراجع عن هذا الإجراء.')) {
                const snapshot = await db.ref('khatmahs/' + kid + '/members').once('value');
                if (snapshot.exists()) {
                    const members = snapshot.val();
                    for (let uid in members) {
                        await db.ref('users/' + uid + '/khatmahs/' + kid).remove();
                    }
                }
                await db.ref('khatmahs/' + kid).remove();
                
                if (this.currentKhatmahId === kid) {
                    this.backToDashboard();
                }
            }
        },

        async leaveKhatmah(kid) {
            if (confirm('هل أنت متأكد من مغادرة هذه الختمة؟')) {
                await db.ref('users/' + app.state.currentUser.uid + '/khatmahs/' + kid).remove();
                await db.ref('khatmahs/' + kid + '/members/' + app.state.currentUser.uid).remove();
                
                if (this.currentKhatmahId === kid) {
                    this.backToDashboard();
                }
            }
        }
    },

    // ==========================================
    // وحدة المنتدى (Community Module)
    // ==========================================
    community: {
        isListening: false,
        postsRef: null,

        init() {
            if (!this.isListening) {
                this.listenToPosts();
            }
        },

        publishPost() {
            if (!app.state.currentUser || !app.state.userName) {
                return alert("عذراً، يبدو أنك لم تقم بتسجيل اسمك بعد. يرجى تحديث الصفحة وإدخال اسمك أولاً!");
            }

            const inputField = document.getElementById('post-text-input');
            const text = inputField.value.trim();
            if (!text) return;

            const postObj = {
                authorUid: app.state.currentUser.uid,
                authorName: app.state.userName,
                text: text,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                likesCount: 0
            };

            db.ref('community_posts').push(postObj)
                .then(() => {
                    inputField.value = ''; // تفريغ الحقل بعد النشر
                })
                .catch(err => {
                    alert("حدث خطأ أثناء النشر! تأكد من اتصالك بالإنترنت.");
                    console.error(err);
                });
        },

        listenToPosts() {
            const feedContainer = document.getElementById('community-feed');
            feedContainer.innerHTML = '<div class="loading-spinner"></div>';
            
            // جلب آخر 50 منشوراً مرتبة زمنياً
            this.postsRef = db.ref('community_posts').orderByChild('timestamp').limitToLast(50);
            
            this.postsRef.on('value', snapshot => {
                feedContainer.innerHTML = '';
                
                if (!snapshot.exists()) {
                    feedContainer.innerHTML = '<p style="text-align:center; padding: 20px; color:var(--text-secondary);">لا توجد مشاركات حتى الآن.. كُن أول من يكتب خطرة أو يشارك إنجازه! 🌟</p>';
                    return;
                }

                const posts = [];
                snapshot.forEach(child => {
                    posts.unshift({ id: child.key, ...child.val() });
                });

                posts.forEach(post => {
                    const el = document.createElement('div');
                    el.className = 'post-card glass-panel';
                    
                    const timeAgo = this.timeSince(post.timestamp);
                    const isMyPost = (app.state.currentUser && post.authorUid === app.state.currentUser.uid);
                    
                    let deleteBtnHTML = isMyPost ? `<button class="action-btn delete-btn" onclick="app.community.deletePost('${post.id}')"><i class="ri-delete-bin-line"></i> حذف</button>` : '';

                    el.innerHTML = `
                        <div class="post-header">
                            <div class="post-author">
                                <div class="post-author-avatar"><i class="ri-user-smile-line"></i></div>
                                <span>${post.authorName || 'فاعل خير'}</span>
                            </div>
                            <div class="post-meta">${timeAgo}</div>
                        </div>
                        <div class="post-content">${this.escapeHTML(post.text)}</div>
                        <div class="post-actions">
                            <button class="action-btn" onclick="app.community.likePost('${post.id}')"><i class="ri-heart-3-line"></i> إعجاب (${post.likesCount || 0})</button>
                            ${deleteBtnHTML}
                        </div>
                    `;
                    feedContainer.appendChild(el);
                });
            });

            this.isListening = true;
        },

        deletePost(postId) {
            if (confirm("هل أنت متأكد من حذف هذه المشاركة؟")) {
                db.ref('community_posts/' + postId).remove().catch(e => alert("فشل الحذف."));
            }
        },

        likePost(postId) {
            const postRef = db.ref('community_posts/' + postId + '/likesCount');
            postRef.transaction(currentLikes => {
                return (currentLikes || 0) + 1;
            });
        },

        timeSince(timestamp) {
            if (!timestamp) return 'مؤخراً';
            const seconds = Math.floor((new Date() - timestamp) / 1000);
            
            let interval = seconds / 31536000;
            if (interval > 1) return "منذ " + Math.floor(interval) + " سنة";
            interval = seconds / 2592000;
            if (interval > 1) return "منذ " + Math.floor(interval) + " شهر";
            interval = seconds / 86400;
            if (interval > 1) return "منذ " + Math.floor(interval) + " يوم";
            interval = seconds / 3600;
            if (interval > 1) return "منذ " + Math.floor(interval) + " ساعة";
            interval = seconds / 60;
            if (interval > 1) return "منذ " + Math.floor(interval) + " دقيقة";
            return "الآن";
        },

        escapeHTML(str) {
            if (!str) return '';
            return str.replace(/[&<>'"]/g, 
                tag => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[tag] || tag)
            );
        }
    },

    // ==========================================
    // وحدة المحفّظ الذكي (Hifz Module)
    // ==========================================
    hifz: {
        isTestMode: false,
        isColorMode: false,
        savedAyahs: {}, // مفتاح: surah-ayah, القيمة: status (strong, learning, weak)
        customWirds: [],
        miniTestMode: false,
        stats: { strong: 0, learning: 0, weak: 0 },

        init() {
            this.loadStats();
        },

        toggleTestMode() {
            this.isTestMode = !this.isTestMode;
            const btn = document.getElementById('toggle-test-btn');
            const readerContent = document.getElementById('quran-page-content');
            
            if (this.isTestMode) {
                btn.classList.add('test-mode-active');
                readerContent.classList.add('test-mode');
            } else {
                btn.classList.remove('test-mode-active');
                readerContent.classList.remove('test-mode');
            }
        },

        toggleColorMode() {
            this.isColorMode = !this.isColorMode;
            const btn = document.getElementById('toggle-color-btn');
            
            if (this.isColorMode) {
                btn.classList.add('color-mode-active');
            } else {
                btn.classList.remove('color-mode-active');
            }
        },

        handleAyahClick(surahNum, ayahNum) {
            if (!this.isColorMode) return;
            
            const key = `${Math.floor(surahNum)}-${Math.floor(ayahNum)}`;
            const currentStatus = this.savedAyahs[key];
            let nextStatus = '';
            
            // دورة الألوان: لا يوجد -> strong -> learning -> weak -> لا يوجد
            if (!currentStatus) nextStatus = 'strong';
            else if (currentStatus === 'strong') nextStatus = 'learning';
            else if (currentStatus === 'learning') nextStatus = 'weak';
            else if (currentStatus === 'weak') nextStatus = null;
            
            if(nextStatus) {
                this.savedAyahs[key] = nextStatus;
            } else {
                delete this.savedAyahs[key];
            }
            
            this.applyColorToAyah(surahNum, ayahNum);
            this.saveToFirebase();
            this.updateDashboard();
        },

        applyColorToAyah(surahNum, ayahNum) {
            const el = document.getElementById(`ayah-txt-${surahNum}-${ayahNum}`);
            if (!el) return;
            
            el.classList.remove('status-strong', 'status-learning', 'status-weak');
            
            const status = this.savedAyahs[`${surahNum}-${ayahNum}`];
            if (status) {
                el.classList.add(`status-${status}`);
            }
        },

        applyAllColors() {
            Object.keys(this.savedAyahs).forEach(key => {
                const parts = key.split('-');
                if(parts.length === 2) {
                    this.applyColorToAyah(parts[0], parts[1]);
                }
            });
        },

        async loadStats() {
            if (app.state.currentUser && typeof db !== 'undefined') {
                db.ref('users/' + app.state.currentUser.uid + '/hifz_v2').on('value', snap => {
                    if (snap.exists()) {
                        const data = snap.val() || {};
                        this.savedAyahs = data.ayahs || {};
                        this.customWirds = data.wirds || [];
                    } else {
                        // خيار استرجاع للنسخة القديمة
                        db.ref('users/' + app.state.currentUser.uid + '/hifz').once('value').then(oldSnap => {
                            if (oldSnap.exists()) {
                                this.savedAyahs = oldSnap.val() || {};
                                this.saveToFirebase(); 
                            }
                        });
                    }
                    this.updateDashboard();
                    this.applyAllColors();
                    this.renderWirdsList();
                });
            } else {
                const saved = localStorage.getItem('quran_hifz_v2');
                if (saved) {
                    const data = JSON.parse(saved);
                    this.savedAyahs = data.ayahs || {};
                    this.customWirds = data.wirds || [];
                    this.updateDashboard();
                    this.applyAllColors();
                    this.renderWirdsList();
                }
            }
        },

        saveToFirebase() {
            const payload = {
                ayahs: this.savedAyahs,
                wirds: this.customWirds
            };
            localStorage.setItem('quran_hifz_v2', JSON.stringify(payload));
            if (app.state.currentUser && typeof db !== 'undefined') {
                db.ref('users/' + app.state.currentUser.uid + '/hifz_v2').set(payload);
            }
        },

        updateDashboard() {
            this.stats = { strong: 0, learning: 0, weak: 0 };
            
            Object.values(this.savedAyahs).forEach(val => {
                if(this.stats[val] !== undefined) this.stats[val]++;
            });
            
            const formatAyah = (num) => num + " آية";
            const sEl = document.getElementById('hifz-strong-count');
            const lEl = document.getElementById('hifz-learning-count');
            const wEl = document.getElementById('hifz-weak-count');
            
            if(sEl) sEl.innerText = formatAyah(this.stats.strong);
            if(lEl) lEl.innerText = formatAyah(this.stats.learning);
            if(wEl) wEl.innerText = formatAyah(this.stats.weak);
        },

        showAddWirdModal() {
            const select = document.getElementById('wird-surah-select');
            if(select && select.options.length <= 1 && app.state.surahs && app.state.surahs.length > 0) {
                app.state.surahs.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.number;
                    opt.setAttribute('data-ayahs', s.numberOfAyahs);
                    opt.textContent = `سورة ${s.name}`;
                    select.appendChild(opt);
                });
            }
            
            document.getElementById('wird-name-input').value = '';
            document.getElementById('wird-surah-select').value = '';
            document.getElementById('wird-from-ayah').value = '';
            document.getElementById('wird-to-ayah').value = '';
            document.getElementById('wird-ayah-hint').innerText = 'الرجاء اختيار السورة...';
            
            document.getElementById('add-wird-modal').style.display = 'flex';
        },

        closeAddWirdModal() {
            document.getElementById('add-wird-modal').style.display = 'none';
        },

        wirdSurahChanged() {
            const select = document.getElementById('wird-surah-select');
            if(select.selectedIndex > 0) {
                const opt = select.options[select.selectedIndex];
                const count = opt.getAttribute('data-ayahs');
                document.getElementById('wird-ayah-hint').innerText = `تحتوي هذه السورة على ${count} آية.`;
                document.getElementById('wird-to-ayah').value = count;
                document.getElementById('wird-from-ayah').value = 1;
            }
        },

        saveCustomWird() {
            const name = document.getElementById('wird-name-input').value.trim();
            const surahSelect = document.getElementById('wird-surah-select');
            const surahNum = surahSelect.value;
            const fromAyah = parseInt(document.getElementById('wird-from-ayah').value);
            const toAyah = parseInt(document.getElementById('wird-to-ayah').value);
            
            if(!name) return alert('الرجاء كتابة اسم الورد');
            if(!surahNum) return alert('الرجاء اختيار السورة');
            if(!fromAyah || !toAyah || fromAyah > toAyah) return alert('نطاق الآيات غير صحيح');
            
            const surahName = surahSelect.options[surahSelect.selectedIndex].text;
            
            const newWird = {
                id: Date.now().toString(),
                name: name,
                surahNumber: parseInt(surahNum),
                surahName: surahName,
                fromAyah: fromAyah,
                toAyah: toAyah
            };
            
            this.customWirds.push(newWird);
            this.saveToFirebase();
            this.closeAddWirdModal();
            this.renderWirdsList();
        },

        deleteWird(id) {
            if(confirm('هل أنت متأكد من حذف هذا الورد؟')) {
                this.customWirds = this.customWirds.filter(w => w.id !== id);
                this.saveToFirebase();
                this.renderWirdsList();
            }
        },

        renderWirdsList() {
            const container = document.getElementById('custom-wirds-list');
            if(!container) return;
            
            container.innerHTML = '';
            if(!this.customWirds || this.customWirds.length === 0) {
                container.innerHTML = '<p style="text-align:center; color: var(--text-secondary); opacity: 0.8; margin-top: 20px;">لم تقم بإضافة أي أوراد خاصة بعد.</p>';
                return;
            }
            
            this.customWirds.forEach(wird => {
                const el = document.createElement('div');
                el.className = 'wird-card glass-panel mb-1';
                el.style.display = 'flex';
                el.style.justifyContent = 'space-between';
                el.style.alignItems = 'center';
                el.style.padding = '15px';
                el.style.borderRadius = '10px';
                
                el.innerHTML = `
                    <div>
                        <h3 style="margin: 0 0 5px 0; color: var(--gold-primary); font-size: 1.1rem;">${app.community.escapeHTML(wird.name)}</h3>
                        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
                            ${wird.surahName} (الآيات: ${wird.fromAyah} - ${wird.toAyah})
                        </p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="primary-btn" style="padding: 5px 12px; font-size: 0.9rem;" onclick="app.hifz.openMiniReader('${wird.id}')">اقرأ</button>
                        <button class="icon-btn" style="color: #e74c3c; width: 35px; height: 35px; min-width: unset;" onclick="app.hifz.deleteWird('${wird.id}')" title="حذف الورد"><i class="ri-delete-bin-line"></i></button>
                    </div>
                `;
                container.appendChild(el);
            });
        },

        async openMiniReader(id) {
            const wird = this.customWirds.find(w => w.id === id);
            if(!wird) return;
            
            document.getElementById('mini-reader-overlay').style.display = 'flex';
            document.getElementById('mini-reader-title').innerText = wird.name;
            const contentDiv = document.getElementById('mini-reader-content');
            contentDiv.innerHTML = '<div class="loading-spinner"></div>';
            
            this.miniTestMode = false;
            contentDiv.classList.remove('test-mode');
            document.getElementById('mini-toggle-test-btn').classList.remove('test-mode-active');
            
            try {
                const res = await fetch(`https://api.alquran.cloud/v1/surah/${wird.surahNumber}/quran-uthmani`);
                const data = await res.json();
                const allAyahs = data.data.ayahs;
                
                const filteredAyahs = allAyahs.filter(a => a.numberInSurah >= wird.fromAyah && a.numberInSurah <= wird.toAyah);
                
                let html = '';
                html += `<div class="surah-header">${wird.surahName.replace('سورة', 'سُورَةُ')}</div>`;
                
                if (wird.fromAyah === 1 && wird.surahNumber !== 9 && wird.surahNumber !== 1) {
                    html += `<span class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>`;
                }

                filteredAyahs.forEach(ayah => {
                    let text = ayah.text;
                    if (ayah.numberInSurah === 1 && wird.surahNumber !== 1 && wird.surahNumber !== 9) {
                        text = text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '').trim();
                    }

                    const words = text.split(' ');
                    html += `<span class="ayah-wrap">`;
                    words.forEach(word => {
                        html += `<span class="quran-word">${word}</span>`;
                    });
                    html += `<span class="ayah-end"><span>${app.reader.toArabicNumbers(ayah.numberInSurah)}</span></span>`;
                    html += `</span>`;
                });
                
                contentDiv.innerHTML = html;
                
            } catch(e) {
                console.error(e);
                contentDiv.innerHTML = '<p style="text-align:center; color: red;">حدث خطأ أثناء تحميل الآيات.</p>';
            }
        },

        closeMiniReader() {
            document.getElementById('mini-reader-overlay').style.display = 'none';
        },

        toggleMiniTestMode() {
            this.miniTestMode = !this.miniTestMode;
            const btn = document.getElementById('mini-toggle-test-btn');
            const cont = document.getElementById('mini-reader-content');
            
            if(this.miniTestMode) {
                btn.classList.add('test-mode-active');
                cont.classList.add('test-mode');
            } else {
                btn.classList.remove('test-mode-active');
                cont.classList.remove('test-mode');
            }
        }
    }
};

// بدء التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
