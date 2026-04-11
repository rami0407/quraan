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
        this.audioPage.init();
        this.analytics.init();
        this.profile.init();
        
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
                            this.updateUserProfileDisplay();
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
                    this.updateUserProfileDisplay();
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
    toggleMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('active');
        }
    },

    toggleNotifications() {
        const menu = document.getElementById('notifications-menu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    updateUserProfileDisplay() {
        const nameDisplay = document.getElementById('topbar-user-name');
        const avatarImg = document.getElementById('topbar-user-avatar');
        if (nameDisplay && avatarImg && this.state.userName) {
            nameDisplay.textContent = this.state.userName;
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.state.userName)}&background=C9A84C&color=0D1B2A&font-family=Tajawal`;
        }
    },

    navigateTo(pageId) {
        // إغلاق القائمة الجانبية في الهاتف (إن كانت مفتوحة)
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('mobile-sidebar-overlay');
        if(sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            if(overlay) overlay.style.display = 'none';
        }

        if (!['home', 'quran', 'khatmah', 'community', 'hifz', 'audio', 'analytics', 'profile'].includes(pageId)) {
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
        } else if (pageId === 'audio') {
            // load first surah by default when visiting for first time
            const player = document.getElementById('full-surah-player');
            if (player && !player.src) {
                app.audioPage.loadSurah();
            }
        } else if (pageId === 'analytics') {
            app.analytics.init();
        } else if (pageId === 'profile') {
            app.profile.init();
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

        // تتبع النشاط اليومي لمخطط الملف الشخصي
        if (this.profile && typeof this.profile.trackTodayActivity === 'function') {
            this.profile.trackTodayActivity(1);
        }

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
                    const juzSelect = document.getElementById('juz-select');
                    if (juzSelect) juzSelect.value = '';
                }
            });
            // إعداد مستمع اختيار الجزء
            const juzSelect = document.getElementById('juz-select');
            if (juzSelect) {
                juzSelect.innerHTML = '<option value="">اختيار الجزء...</option>';
                for (let i = 1; i <= 30; i++) {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = `الجزء ${i}`;
                    juzSelect.appendChild(opt);
                }
                juzSelect.addEventListener('change', (e) => {
                    if (e.target.value) {
                        this.loadJuz(parseInt(e.target.value));
                        const surahSelect = document.getElementById('surah-select');
                        if (surahSelect) surahSelect.value = '';
                    }
                });
            }
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

                // تعبئة قائمة سور صفحة الاستماع أيضاً
                const audioSelect = document.getElementById('audio-page-surah');
                if (audioSelect) {
                    audioSelect.innerHTML = app.state.surahs.map(surah =>
                        `<option value="${surah.number}">سورة ${surah.name}</option>`
                    ).join('');
                }
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
                        html += `<span class="quran-word">${word}</span> `;
                    });

                    const isActiveBookmark = (app.state.bookmarkedSurah === surahNumber && app.state.bookmarkedAyah === ayah.numberInSurah) ? 'active' : '';
                    html += `<span class="ayah-end" onclick="app.hifz.revealAyah(event, ${surahNumber}, ${ayah.numberInSurah})" style="cursor: pointer;"><span>${this.toArabicNumbers(ayah.numberInSurah)}</span></span>`;
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
                        html += `<span class="quran-word">${word}</span> `;
                    });

                    const isActiveBookmark = (app.state.bookmarkedSurah === surahNumber && app.state.bookmarkedAyah === ayah.numberInSurah) ? 'active' : '';
                    html += `<span class="ayah-end" onclick="app.hifz.revealAyah(event, ${surahNumber}, ${ayah.numberInSurah})" style="cursor: pointer;"><span>${this.toArabicNumbers(ayah.numberInSurah)}</span></span>`;
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
        },

        currentActionSheetSurah: null,
        currentActionSheetAyah: null,

        async openAyahActionSheet(surahNum, ayahNum) {
            this.currentActionSheetSurah = surahNum;
            this.currentActionSheetAyah = ayahNum;
            
            const sheet = document.getElementById('ayah-action-sheet');
            sheet.style.display = 'flex';
            document.getElementById('action-sheet-loading').style.display = 'block';
            document.getElementById('action-sheet-content').style.display = 'none';

            const surah = app.state.surahs.find(s => parseInt(s.number) === parseInt(surahNum));
            document.getElementById('action-sheet-title').innerText = `سورة ${surah ? surah.name : ''} - آية ${this.toArabicNumbers(ayahNum)}`;

            this.loadActionSheetData();
        },

        async loadActionSheetData() {
            const surahNum = this.currentActionSheetSurah;
            const ayahNum = this.currentActionSheetAyah;
            if (!surahNum || !ayahNum) return;

            const reciterSelect = document.getElementById('action-sheet-reciter');
            const tafsirSelect = document.getElementById('action-sheet-tafsir');
            
            const reciter = reciterSelect ? reciterSelect.value : 'ar.alafasy';
            const tafsir = tafsirSelect ? tafsirSelect.value : 'ar.muyassar';

            try {
                const audio = document.getElementById('ayah-audio-player');
                if (audio) {
                    audio.pause();
                    document.getElementById('ayah-play-icon').className = 'ri-play-fill';
                }

                document.getElementById('action-sheet-loading').style.display = 'block';
                document.getElementById('action-sheet-content').style.display = 'none';

                const res = await fetch(`https://api.alquran.cloud/v1/ayah/${surahNum}:${ayahNum}/editions/quran-uthmani,${tafsir},${reciter}`);
                const data = await res.json();
                
                const tafsirText = data.data[1].text;
                const audioUrl = data.data[2].audio;
                const tafsirName = data.data[1].edition.name;
                const reciterName = data.data[2].edition.name;

                document.getElementById('ayah-tafsir-text').innerText = tafsirText;
                document.getElementById('action-sheet-tafsir-name').innerHTML = `<i class="ri-book-open-fill"></i> ${tafsirName}`;
                
                document.getElementById('action-sheet-reciter-name').innerText = `تلاوة ${reciterName}`;
                document.getElementById('ayah-audio-player').src = audioUrl;

                document.getElementById('action-sheet-loading').style.display = 'none';
                document.getElementById('action-sheet-content').style.display = 'flex';
                
                this.setupAudioListeners();

            } catch(e) {
                console.error("Error loading action sheet:", e);
                document.getElementById('action-sheet-loading').innerHTML = '<p style="color:var(--danger); margin-top:15px;">حدث خطأ في تحميل البيانات. يرجى التأكد من اتصالك.</p>';
            }
        },

        changeActionSheetOptions() {
            this.loadActionSheetData();
        },

        toggleAyahAudio() {
            const audio = document.getElementById('ayah-audio-player');
            const icon = document.getElementById('ayah-play-icon');
            if (audio.paused) {
                audio.play();
                icon.className = 'ri-pause-fill';
            } else {
                audio.pause();
                icon.className = 'ri-play-fill';
            }
        },

        setupAudioListeners() {
            const audio = document.getElementById('ayah-audio-player');
            audio.ontimeupdate = () => {
                const percent = (audio.currentTime / audio.duration) * 100 || 0;
                document.getElementById('audio-progress-bar').style.width = percent + '%';
                document.getElementById('audio-current-time').innerText = app.reader.formatTime(audio.currentTime);
                if (audio.duration) {
                    document.getElementById('audio-duration').innerText = app.reader.formatTime(audio.duration);
                }
            };
            audio.onended = () => {
                document.getElementById('ayah-play-icon').className = 'ri-play-fill';
                document.getElementById('audio-progress-bar').style.width = '0%';
                document.getElementById('audio-current-time').innerText = '00:00';
            };
        },

        formatTime(seconds) {
            if (isNaN(seconds)) return "00:00";
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
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

        revealAyah(event, surahNum, ayahNum) {
            if (this.isTestMode) {
                event.stopPropagation();
                const el = document.getElementById(`ayah-txt-${surahNum}-${ayahNum}`);
                if (el) el.classList.toggle('revealed');
            }
        },

        handleAyahClick(surahNum, ayahNum) {
            if (this.isColorMode) {
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
            } else if (!this.isTestMode) {
                app.reader.openAyahActionSheet(surahNum, ayahNum);
            }
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
    },

    audioPage: {
        init() {
            const surahSelect = document.getElementById('audio-page-surah');
            if(surahSelect && app.state.surahs && app.state.surahs.length > 0) {
                surahSelect.innerHTML = app.state.surahs.map(s => 
                    `<option value="${s.number}">سورة ${s.name}</option>`
                ).join('');
            }
        },
        loadSurah() {
            const surahSelect = document.getElementById('audio-page-surah');
            const reciterSelect = document.getElementById('audio-page-reciter');
            if(!surahSelect || !reciterSelect) return;
            
            const surahNum = surahSelect.value;
            const reciter = reciterSelect.value;
            
            const surahName = surahSelect.options[surahSelect.selectedIndex].text;
            document.getElementById('audio-page-title').innerText = `${surahName}`;

            const player = document.getElementById('full-surah-player');
            player.src = `https://cdn.islamic.network/quran/audio-surah/128/${reciter}/${surahNum}.mp3`;
            player.play().catch(e => console.log('Autoplay prevented', e));
        }
    },

    analytics: {
        init() {
            const pagesRead = localStorage.getItem('quran_pages_read') || 0;
            const streak = localStorage.getItem('quran_streak_days') || 0;
            
            const pagesEl = document.getElementById('analytics-pages-count');
            const streakEl = document.getElementById('analytics-streak');
            
            if(pagesEl) pagesEl.innerText = pagesRead;
            if(streakEl) streakEl.innerText = streak + ' يوم';
            
            const hifzToggle = document.getElementById('hifz-tester-toggle');
            if(hifzToggle) {
                const isTesterOn = localStorage.getItem('hifz_tester_on') === 'true';
                hifzToggle.checked = isTesterOn;
                this.toggleHifzTester(true);
            }
        },

        toggleHifzTester(fromInit = false) {
            const toggle = document.getElementById('hifz-tester-toggle');
            const container = document.getElementById('hifz-test-container');
            if(!toggle || !container) return;
            
            if(!fromInit) {
                localStorage.setItem('hifz_tester_on', toggle.checked);
            }
            
            if(toggle.checked) {
                container.style.display = 'block';
                this.generateNextTest();
            } else {
                container.style.display = 'none';
            }
        },

        async generateNextTest() {
            const ayahEl = document.getElementById('hifz-test-ayah');
            ayahEl.innerHTML = '<div class="loading-spinner" style="width:20px;height:20px;margin:auto;"></div>';
            
            const randomSurah = Math.floor(Math.random() * 114) + 1;
            const surahDetails = app.state.surahs.find(s => parseInt(s.number) === randomSurah);
            if(!surahDetails) return;
            const randomAyah = Math.floor(Math.random() * surahDetails.numberOfAyahs) + 1;
            
            try {
                const res = await fetch(`https://api.alquran.cloud/v1/ayah/${randomSurah}:${randomAyah}/quran-uthmani`);
                const data = await res.json();
                
                const ayahText = data.data.text;
                const words = ayahText.split(' ');
                const obscured = words.map((w, i) => {
                    if(i > 0 && Math.random() > 0.6) {
                        return '<span style="background:var(--glass-border); color:transparent; border-radius:4px; padding:0 5px; cursor:pointer; transition: all 0.3s;" onclick="this.style.color=\'var(--text-primary)\';this.style.background=\'transparent\'">.....</span>';
                    }
                    return w;
                }).join('  ');
                
                ayahEl.innerHTML = `<div><span style="font-size:0.9rem; color:var(--text-secondary); display:block; margin-bottom:15px;">سورة ${surahDetails.name} - الآية ${randomAyah}</span>${obscured}</div>`;
            } catch(e) {
                ayahEl.innerHTML = 'تعذر تحميل الآية. تأكد من اتصالك بالإنترنت.';
            }
        }
    },

    profile: {
        data: {},

        // تعريف الشارات
        BADGES: [
            {
                id: 'first_step',
                emoji: '🌟',
                name: 'أول خطوة',
                desc: 'قرأت لأول مرة',
                check: (stats) => stats.totalPages >= 1
            },
            {
                id: 'streak_3',
                emoji: '🔥',
                name: '3 أيام متتالية',
                desc: 'حافظت على وردك 3 أيام',
                check: (stats) => stats.streakDays >= 3
            },
            {
                id: 'streak_7',
                emoji: '🏆',
                name: 'أسبوع كامل',
                desc: 'استمريت 7 أيام متتالية',
                check: (stats) => stats.streakDays >= 7
            },
            {
                id: 'streak_30',
                emoji: '👑',
                name: 'شهر من الالتزام',
                desc: 'استمريت 30 يوماً متتالياً',
                check: (stats) => stats.streakDays >= 30
            },
            {
                id: 'pages_50',
                emoji: '📖',
                name: '50 صفحة',
                desc: 'أتممت 50 صفحة من القرآن',
                check: (stats) => stats.totalPages >= 50
            },
            {
                id: 'pages_100',
                emoji: '📚',
                name: 'مئة صفحة',
                desc: 'وصلت إلى 100 صفحة مقروءة',
                check: (stats) => stats.totalPages >= 100
            },
            {
                id: 'memorizer',
                emoji: '🧠',
                name: 'حافظ مبتدئ',
                desc: 'حفظت أول 10 آيات',
                check: (stats) => stats.hifzCount >= 10
            },
            {
                id: 'group_member',
                emoji: '👥',
                name: 'روح الجماعة',
                desc: 'انضممت لختمة جماعية',
                check: (stats) => stats.joinedKhatmah === true
            },
            {
                id: 'community_voice',
                emoji: '💬',
                name: 'صوت المجتمع',
                desc: 'شاركت في المنتدى',
                check: (stats) => stats.communityPosts >= 1
            },
            {
                id: 'profile_complete',
                emoji: '✨',
                name: 'ملف مكتمل',
                desc: 'أكملت بيانات ملفك الشخصي',
                check: (stats) => stats.profileComplete === true
            }
        ],

        init() {
            this.loadProfile();
        },

        // تتبع نشاط اليوم (يُستدعى من saveProgress)
        trackTodayActivity(pagesCount = 1) {
            const today = new Date().toISOString().split('T')[0];
            const saved = localStorage.getItem('quran_daily_activity');
            const activity = saved ? JSON.parse(saved) : {};
            activity[today] = (activity[today] || 0) + pagesCount;
            localStorage.setItem('quran_daily_activity', JSON.stringify(activity));
        },

        // جلب بيانات الإحصائيات الفعلية
        getStats() {
            const progress = JSON.parse(localStorage.getItem('quran_progress') || '{}');
            const hifzData = JSON.parse(localStorage.getItem('quran_hifz') || '{}');
            const profileData = JSON.parse(localStorage.getItem('quran_profile') || '{}');
            const activityData = JSON.parse(localStorage.getItem('quran_daily_activity') || '{}');
            const communityPosts = parseInt(localStorage.getItem('quran_community_posts') || '0');
            const khatmahJoined = localStorage.getItem('quran_khatmah_joined') === 'true';

            // حساب الأيام المتتالية
            let streakDays = 0;
            const today = new Date();
            for (let i = 0; i < 365; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const key = d.toISOString().split('T')[0];
                if (activityData[key] && activityData[key] > 0) {
                    streakDays++;
                } else if (i > 0) {
                    break;
                }
            }

            // حساب آيات الحفظ
            const hifzCount = Object.keys(hifzData).length;

            // التحقق من اكتمال الملف
            const profileComplete = !!(profileData.displayName && profileData.country && profileData.bio);

            return {
                totalPages: progress.readPages || 0,
                streakDays,
                hifzCount,
                joinedKhatmah: khatmahJoined,
                communityPosts,
                profileComplete,
                activity: activityData
            };
        },

        loadProfile() {
            const saved = localStorage.getItem('quran_profile');
            if (saved) {
                this.data = JSON.parse(saved);
            }

            const d = this.data;
            const stats = this.getStats();

            // --- تعبئة النموذج ---
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
            setVal('profile-display-name', d.displayName);
            setVal('profile-full-name', d.fullName);
            setVal('profile-country', d.country);
            setVal('profile-age', d.age);
            setVal('profile-bio', d.bio);

            const pubToggle = document.getElementById('privacy-public');
            const msgToggle = document.getElementById('privacy-messages');
            if (pubToggle && d.privacyPublic !== undefined) pubToggle.checked = d.privacyPublic;
            if (msgToggle && d.privacyMessages !== undefined) msgToggle.checked = d.privacyMessages;

            // --- تحديث البانر ---
            const displayName = d.displayName || app.state.userName || 'مستخدم';
            const setHTML = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
            const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

            setText('profile-name-display', displayName);
            setHTML('profile-country-display', `<i class="ri-map-pin-2-line"></i> ${d.country || '—'}`);

            const bioDisplay = document.getElementById('profile-bio-display');
            if (bioDisplay) bioDisplay.textContent = d.bio || '';

            const input = document.getElementById('profile-inline-name-input');
            if (input) input.value = displayName;

            // --- الصورة ---
            const avatarEl = document.getElementById('profile-avatar-display');
            if (avatarEl) {
                avatarEl.src = d.photoUrl
                    ? d.photoUrl
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=C9A84C&color=0D1B2A&size=120&bold=true`;
            }

            // --- إحصائيات سريعة (البانر) ---
            setText('pqs-pages', stats.totalPages);
            setText('pqs-streak', stats.streakDays);

            // --- الإحصائيات التفصيلية ---
            setText('profile-stat-pages', stats.totalPages);
            const el = document.getElementById('profile-stat-streak');
            if (el) el.textContent = stats.streakDays + ' يوم';
            const joinDate = d.joinDate || new Date().toLocaleDateString('ar-SA');
            setText('profile-stat-joined', joinDate);

            // --- رابط الدعوة ---
            this.generateInviteLink();

            // --- الشارات ---
            this.renderBadges(stats);

            // --- مخطط النشاط ---
            this.renderActivityChart(stats.activity);

            // --- الـ Topbar ---
            app.updateUserProfileDisplay();
        },

        // ======= نظام الشارات =======
        renderBadges(stats) {
            const grid = document.getElementById('badges-grid');
            if (!grid) return;

            const earnedBadgeIds = JSON.parse(localStorage.getItem('quran_earned_badges') || '[]');
            let earnedCount = 0;
            let html = '';

            this.BADGES.forEach(badge => {
                const isEarned = badge.check(stats) || earnedBadgeIds.includes(badge.id);

                if (isEarned && !earnedBadgeIds.includes(badge.id)) {
                    earnedBadgeIds.push(badge.id);
                    localStorage.setItem('quran_earned_badges', JSON.stringify(earnedBadgeIds));
                    // إشعار لأول مرة
                    setTimeout(() => this.showBadgeToast(badge), 300);
                }

                if (isEarned) earnedCount++;

                html += `
                <div class="badge-item ${isEarned ? 'earned' : 'locked'}" title="${badge.desc}">
                    ${isEarned ? '<div class="badge-earned-checkmark">✓</div>' : ''}
                    <span class="badge-emoji">${badge.emoji}</span>
                    <span class="badge-name">${badge.name}</span>
                    <span class="badge-desc">${badge.desc}</span>
                </div>`;
            });

            grid.innerHTML = html;

            // عداد الشارات
            const chip = document.getElementById('badge-count-chip');
            if (chip) chip.textContent = `${earnedCount} / ${this.BADGES.length}`;
            const pqsBadges = document.getElementById('pqs-badges');
            if (pqsBadges) pqsBadges.textContent = earnedCount;
        },

        showBadgeToast(badge) {
            const toast = document.createElement('div');
            toast.style.cssText = `
                position:fixed; bottom:30px; left:50%; transform:translateX(-50%) translateY(80px);
                background: linear-gradient(135deg, #1B4332, #0d1b2a);
                border: 1px solid var(--gold-primary);
                color:#fff; padding:14px 24px; border-radius:16px;
                font-size:1rem; z-index:99999;
                box-shadow:0 8px 30px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.3);
                display:flex; align-items:center; gap:12px;
                transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s;
                opacity: 0;
            `;
            toast.innerHTML = `<span style="font-size:2rem;">${badge.emoji}</span><div><p style="font-weight:700;color:var(--gold-primary)">شارة جديدة! 🎉</p><p style="font-size:0.9rem;opacity:0.8;">${badge.name}</p></div>`;
            document.body.appendChild(toast);

            requestAnimationFrame(() => {
                toast.style.transform = 'translateX(-50%) translateY(0)';
                toast.style.opacity = '1';
            });

            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(80px)';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 400);
            }, 3500);
        },

        // ======= مخطط النشاط =======
        renderActivityChart(activityData) {
            const chart = document.getElementById('activity-chart');
            if (!chart) return;

            const today = new Date();
            const days = [];
            let totalActivePages = 0;

            // آخر 30 يوماً
            for (let i = 29; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const key = d.toISOString().split('T')[0];
                const pages = activityData[key] || 0;
                totalActivePages += pages;
                days.push({
                    date: key,
                    pages,
                    isToday: i === 0,
                    label: d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
                });
            }

            // تحديد مستوى اللون
            const maxPages = Math.max(...days.map(d => d.pages), 1);
            const getLevel = (pages) => {
                if (pages === 0) return 0;
                const ratio = pages / maxPages;
                if (ratio <= 0.2) return 1;
                if (ratio <= 0.4) return 2;
                if (ratio <= 0.6) return 3;
                if (ratio <= 0.8) return 4;
                return 5;
            };

            chart.innerHTML = days.map(d => `
                <div class="activity-day"
                    data-level="${getLevel(d.pages)}"
                    ${d.isToday ? 'data-today="true"' : ''}
                    title="${d.label}: ${d.pages} صفحة">
                </div>
            `).join('');

            // ملخص النشاط
            const activeDays = days.filter(d => d.pages > 0).length;
            const totalLabel = document.getElementById('activity-total-label');
            if (totalLabel) {
                totalLabel.textContent = `${activeDays} يوم نشط | ${totalActivePages} صفحة مقروءة`;
            }
        },

        // ======= رابط الدعوة =======
        generateInviteLink() {
            const user = app.state.currentUser;
            const uid = user ? user.uid.slice(0, 8) : 'khatmah';
            const link = `${window.location.origin}${window.location.pathname}?ref=${uid}`;
            const input = document.getElementById('invite-link-input');
            if (input) input.value = link;
            return link;
        },

        copyInviteLink() {
            const link = this.generateInviteLink();
            navigator.clipboard.writeText(link).then(() => {
                const btn = document.getElementById('invite-copy-btn');
                if (btn) {
                    const orig = btn.innerHTML;
                    btn.innerHTML = '<i class="ri-check-line"></i> تم النسخ!';
                    btn.style.background = 'linear-gradient(135deg, #27ae60, #1e8449)';
                    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 2000);
                }
            }).catch(() => {
                // Fallback
                const input = document.getElementById('invite-link-input');
                if (input) { input.select(); document.execCommand('copy'); }
            });
        },

        shareViaWhatsApp() {
            const name = this.data.displayName || app.state.userName || 'أنا';
            const link = this.generateInviteLink();
            const text = `السلام عليكم 🌙\nأدعوك للانضمام معي في تطبيق ختمة للقرآن الكريم.\nانضم الآن: ${link}\n#ختمة #قرآن`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        },

        shareViaTwitter() {
            const link = this.generateInviteLink();
            const text = `أقرأ القرآن الكريم مع تطبيق ختمة 📖 انضم معي في رحلة القرآن!\n${link}\n#ختمة #قرآن`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
        },

        // ======= تعديل الاسم المضمّن =======
        toggleInlineEdit() {
            const editDiv = document.getElementById('profile-inline-edit');
            const nameRow = document.querySelector('.profile-name-row');
            if (!editDiv || !nameRow) return;

            const isVisible = editDiv.style.display !== 'none';
            editDiv.style.display = isVisible ? 'none' : 'flex';
            if (nameRow) nameRow.style.display = isVisible ? 'flex' : 'none';

            if (!isVisible) {
                const input = document.getElementById('profile-inline-name-input');
                if (input) {
                    input.value = document.getElementById('profile-name-display')?.textContent || '';
                    input.focus();
                }
            }
        },

        saveInlineName() {
            const input = document.getElementById('profile-inline-name-input');
            if (!input) return;
            const name = input.value.trim();
            if (!name) return;

            // تحديث الحالة
            app.state.userName = name;
            this.data.displayName = name;

            // حفظ في localStorage
            const saved = localStorage.getItem('quran_profile');
            const profileData = saved ? JSON.parse(saved) : {};
            profileData.displayName = name;
            localStorage.setItem('quran_profile', JSON.stringify(profileData));
            this.data = profileData;

            // حفظ في Firebase
            if (app.state.currentUser && typeof db !== 'undefined') {
                db.ref('users/' + app.state.currentUser.uid + '/name').set(name);
                db.ref('users/' + app.state.currentUser.uid + '/profile').update({ displayName: name });
            }

            // تحديث الواجهة
            const nameDisplay = document.getElementById('profile-name-display');
            if (nameDisplay) nameDisplay.textContent = name;
            this.toggleInlineEdit();
            app.updateUserProfileDisplay();

            // تحديث حقل النموذج أيضاً
            const formInput = document.getElementById('profile-display-name');
            if (formInput) formInput.value = name;

            this.showSuccessToast('تم تحديث الاسم بنجاح');
        },

        // ======= حفظ الملف الكامل =======
        saveProfile() {
            const btn = document.getElementById('profile-save-btn');
            if (btn) {
                btn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto;"></div>';
                btn.disabled = true;
            }

            const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

            const displayName = getVal('profile-display-name') || app.state.userName || '';
            this.data = {
                ...this.data,
                displayName,
                fullName: getVal('profile-full-name'),
                country: getVal('profile-country'),
                age: getVal('profile-age'),
                bio: getVal('profile-bio'),
                privacyPublic: document.getElementById('privacy-public')?.checked ?? true,
                privacyMessages: document.getElementById('privacy-messages')?.checked ?? true,
                joinDate: this.data.joinDate || new Date().toLocaleDateString('ar-SA')
            };

            localStorage.setItem('quran_profile', JSON.stringify(this.data));

            if (app.state.currentUser && typeof db !== 'undefined') {
                db.ref('users/' + app.state.currentUser.uid + '/profile').set(this.data)
                    .catch(e => console.error('Error saving profile:', e));
            }

            if (displayName) {
                app.state.userName = displayName;
                app.updateUserProfileDisplay();
            }

            setTimeout(() => {
                if (btn) {
                    btn.innerHTML = '<i class="ri-save-3-line"></i> حفظ الملف';
                    btn.disabled = false;
                }
                this.loadProfile();
                this.showSuccessToast('✅ تم حفظ الملف الشخصي بنجاح');
            }, 600);
        },

        showSuccessToast(msg) {
            const toast = document.createElement('div');
            toast.style.cssText = `
                position:fixed; bottom:30px; left:50%; transform:translateX(-50%);
                background:linear-gradient(135deg,#1B4332,#2ecc71);
                color:#fff; padding:13px 28px; border-radius:30px;
                font-size:1rem; z-index:9999;
                box-shadow:0 4px 20px rgba(0,0,0,0.5);
                animation: slideUpFade 0.35s ease forwards;
            `;
            toast.textContent = msg;

            const style = document.createElement('style');
            style.textContent = `@keyframes slideUpFade { from { opacity:0; transform:translateX(-50%) translateY(20px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
            document.head.appendChild(style);

            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2800);
        },

        handlePhotoUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const photoUrl = e.target.result;
                this.data.photoUrl = photoUrl;
                const avatarEl = document.getElementById('profile-avatar-display');
                if (avatarEl) avatarEl.src = photoUrl;
                const topBar = document.getElementById('topbar-user-avatar');
                if (topBar) topBar.src = photoUrl;
                // حفظ الصورة
                const saved = localStorage.getItem('quran_profile');
                const profileData = saved ? JSON.parse(saved) : {};
                profileData.photoUrl = photoUrl;
                localStorage.setItem('quran_profile', JSON.stringify(profileData));
            };
            reader.readAsDataURL(file);
        }
    }
};

// بدء التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
