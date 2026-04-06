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
        if (!['home', 'quran', 'khatmah', 'community'].includes(pageId)) {
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
                    html += `<span id="ayah-txt-${surahNumber}-${ayah.numberInSurah}">`;
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

        showCreateModal() { document.getElementById('create-khatmah-modal').style.display = 'flex'; },
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
                                    <h3 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:5px;">${khatmah.name}</h3>
                                    <p style="font-size:0.8rem; color:var(--text-secondary);">الأعضاء: ${Object.keys(khatmah.members||{}).length} | نسبة الإنجاز: ${pct}%</p>
                                </div>
                                <i class="ri-arrow-left-s-line" style="font-size:1.5rem; color:var(--gold-primary);"></i>
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
            if(!name) return alert("الرجاء إدخال اسم الختمة.");
            if(!app.state.currentUser || !app.state.userName) return alert("الرجاء تسجيل اسمك للمتابعة.");

            const code = Math.random().toString(36).substr(2, 6).toUpperCase();
            
            // تهيئة 30 جزءاً
            const initialAjza = Array.from({length: 30}, (_, i) => ({
                index: i + 1,
                status: 'available',
                ownerUid: null,
                ownerName: null
            }));

            const kData = {
                name: name,
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

        openKhatmah(id) {
            this.currentKhatmahId = id;
            document.getElementById('khatmah-dashboard').style.display = 'none';
            document.getElementById('khatmah-detail').style.display = 'block';
            
            // استماع فوري للتغييرات في هذه الختمة
            db.ref('khatmahs/' + id).on('value', snapshot => {
                if(!snapshot.exists()) return;
                const data = snapshot.val();
                
                document.getElementById('khatmah-title').innerText = data.name;
                document.getElementById('khatmah-code').innerText = data.code;
                
                const ajza = data.ajza || [];
                const completedCount = ajza.filter(j => j.status === 'completed').length;
                const pct = Math.round((completedCount/30)*100);
                
                document.getElementById('khatmah-progress-text').innerText = `${pct}%`;
                document.getElementById('khatmah-progress-svg').style.strokeDasharray = `${pct}, 100`;

                this.renderAjza(ajza);
            });
        },

        renderAjza(ajza) {
            const grid = document.getElementById('ajza-grid');
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
    }
};

// بدء التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
