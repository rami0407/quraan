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
        }
    },

    // تهيئة التطبيق بمجرد التحميل
    init() {
        this.setupNavigation();
        this.updateDate();
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
        if (!['home', 'quran', 'khatmah'].includes(pageId)) {
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
            this.reader.loadPage(this.state.quranPage);
        } else if (pageId === 'khatmah') {
            this.khatmah.init();
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
            } else {
                // جلب من localStorage كبديل مبدئي عند أول تسجيل دخول لعدم فقدان تقدمه السابق
                const saved = localStorage.getItem('quran_progress');
                if (saved) {
                    const data = JSON.parse(saved);
                    this.state.quranPage = data.lastPage || 1;
                    this.state.dailyProgress.readPages = data.readPages || 0;
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
    // وحدة قارئ القرآن (Reader Module)
    // ==========================================
    reader: {
        isLoaded: false,
        
        init() {
            this.fetchSurahs();
            // إعداد مستمع اختيار السورة
            document.getElementById('surah-select').addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadPageBySurah(e.target.value);
                }
            });
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

        async loadPageBySurah(surahNumber) {
            // بحث عن أول صفحة في السورة
            // لحسن الحظ API alquran يتيح لنا جلب السورة. سنجلب السورة ونقراً أول صفحة فيها
            // ولكن لتسهيل الأمر هنا سنجلب السورة كاملة ونعرف صفحة أول آية
            try {
                document.getElementById('quran-page-content').innerHTML = '<div class="loading-spinner"></div>';
                const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}`);
                const data = await res.json();
                const startPage = data.data.ayahs[0].page;
                this.loadPage(startPage);
            } catch (err) {
                console.error(err);
            }
        },

        // جلب محتويات صفحة محددة
        async loadPage(pageNum) {
            if (pageNum < 1 || pageNum > 604) return;
            
            app.state.quranPage = pageNum;
            this.isLoaded = true;
            
            const contentDiv = document.getElementById('quran-page-content');
            contentDiv.innerHTML = '<div class="loading-spinner"></div>';
            document.getElementById('current-page-display').textContent = `صفحة ${pageNum}`;

            // حفظ التقدم
            app.saveProgress(pageNum);

            try {
                // جلب الصفحة بالرسم العثماني
                const res = await fetch(`https://api.alquran.cloud/v1/page/${pageNum}/quran-uthmani`);
                const data = await res.json();
                const ayahs = data.data.ayahs;
                
                let html = '';
                let currentSurah = null;

                ayahs.forEach(ayah => {
                    // تحقق إذا كانت السورة قد تغيرت لرسم البسملة والاسم
                    if (ayah.surah.number !== currentSurah) {
                        currentSurah = ayah.surah.number;
                        html += `<div class="surah-header">سُورَةُ ${ayah.surah.name}</div>`;
                        
                        // لا نرسم البسملة في سورة التوبة (رقم 9) ولا في وسط السورة
                        if (currentSurah !== 9 && ayah.numberInSurah === 1 && currentSurah !== 1) {
                            html += `<span class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>`;
                        }
                    }

                    // إزالة البسملة المدمجة المرجعة من الـ API في أول الآية (توجد في الفاتحة وباقي السور)
                    let text = ayah.text;
                    if (ayah.numberInSurah === 1 && currentSurah !== 1 && currentSurah !== 9) {
                        text = text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '').trim();
                    }

                    // تجميع الكلمات
                    const words = text.split(' ');
                    words.forEach(word => {
                        html += `<span class="quran-word">${word}</span>`;
                    });

                    // إضافة رقم الآية
                    html += `<span class="ayah-end"><span>${this.toArabicNumbers(ayah.numberInSurah)}</span></span>`;
                });

                contentDiv.innerHTML = `<div class="p-4" style="text-align: justify; direction: rtl;">${html}</div>`;

                // تحديث قائمة السور المنسدلة بناءً على أول سورة في الصفحة
                const selectElement = document.getElementById('surah-select');
                if (selectElement && ayahs.length > 0) {
                    selectElement.value = ayahs[0].surah.number;
                }

            } catch (err) {
                console.error("خطأ في جلب الآيات:", err);
                contentDiv.innerHTML = '<p style="text-align:center; color: red;">حدث خطأ في جلب بيانات الصفحة. يرجى التأكد من اتصال الإنترنت.</p>';
            }
        },

        nextPage() {
            if (app.state.quranPage > 1) {
                this.loadPage(app.state.quranPage - 1);
            }
        },

        prevPage() {
            if (app.state.quranPage < 604) {
                this.loadPage(app.state.quranPage + 1);
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
    }
};

// بدء التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
