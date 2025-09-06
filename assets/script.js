class QuranPlayer {
    constructor() {
        this.audioPlayer = document.getElementById('audio-player');
        this.playlist = [];
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.isAutoplay = true;
        this.isRepeatMode = false;
        this.currentReciter = '1';
        this.currentChapterData = null;
        this.reciters = {};
        this.currentAyahIndex = 0;
        this.fontSize = 16;

        this.initializeElements();
        this.loadReciters();
        this.setupEventListeners();
        this.loadPlaylist();

        // Add periodic state saving
        setInterval(() => {
            this.savePlayerState();
        }, 5000);
    }

    initializeElements() {
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.repeatBtn = document.getElementById('repeat-btn');
        this.autoplayToggle = document.getElementById('autoplay-toggle');
        this.playAllBtn = document.getElementById('play-all-btn');
        this.volumeSlider = document.getElementById('volume-slider');
        this.reciterSelect = document.getElementById('reciter-select');
        this.viewToggle = document.getElementById('view-toggle');
        this.showSurahTextBtn = document.getElementById('show-surah-text-btn');
        this.mushaf = document.getElementById('mushaf');
        this.mushafText = document.getElementById('mushaf-text');
        this.mushafClose = document.getElementById('mushaf-close');
        this.showMushafBtn = document.getElementById('show-mushaf-btn');
        this.fontIncreaseBtn = document.getElementById('font-increase');
        this.fontDecreaseBtn = document.getElementById('font-decrease');
        this.progressBar = document.querySelector('.progress-bar');
        this.progressFill = document.getElementById('progress-fill');
        this.progressHandle = document.getElementById('progress-handle');
        this.currentTime = document.getElementById('current-time');
        this.duration = document.getElementById('duration');
        this.currentSurahName = document.getElementById('current-surah-name');
        this.currentSurahInfo = document.getElementById('current-surah-info');
        this.playlistContainer = document.getElementById('playlist');
        this.searchInput = document.getElementById('search-input');
        this.surahModal = document.getElementById('surah-modal');
        this.modalTitle = document.getElementById('modal-surah-title');
        this.modalContent = document.getElementById('surah-text-content');
        this.closeModal = document.getElementById('close-modal');
    }

    async loadReciters() {
        try {
            const response = await fetch('https://quranapi.pages.dev/api/reciters.json');
            this.reciters = await response.json();
            this.populateReciterSelect();
        } catch (error) {
            console.error('Error loading reciters:', error);
        }
    }

    populateReciterSelect() {
        // Arabic names mapping for the reciters
        const arabicNames = {
            '1': 'مشاري راشد العفاسي',
            '2': 'أبو بكر الشاطري',
            '3': 'ناصر القطامي',
            '4': 'ياسر الدوسري',
            '5': 'هاني الرفاعي'
        };

        if (this.reciterSelect && this.reciters) {
            this.reciterSelect.innerHTML = '';
            Object.entries(this.reciters).forEach(([id, name]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = arabicNames[id] || name;
                this.reciterSelect.appendChild(option);
            });
        }
    }

    async loadPlaylist() {
        try {
            console.log('Loading all chapter data from Quran API...');
            this.playlist = [];

            // Load all chapter data at once
            await this.loadAllChapterData();

            this.filteredPlaylist = [...this.playlist];
            this.renderPlaylist();

            // Load player state after playlist is ready
            this.loadPlayerState();
        } catch (error) {
            console.error('Error loading playlist:', error);
            this.showError('خطأ في تحميل قائمة التشغيل');
        }
    }

    async loadAllChapterData() {
        // Load priority chapters first for immediate use
        const priorityChapters = 10;

        console.log('Loading priority chapters...');
        for (const chapterNum of Array(priorityChapters).keys()) {
            await this.loadSingleChapter(chapterNum + 1);
        }

        // Load remaining chapters in background
        console.log('Loading remaining chapters in background...');
        setTimeout(async () => {
            for (let i = priorityChapters + 1; i <= 114; i++) {
                await this.loadSingleChapter(i);
                // Re-render playlist after each chapter loads to show progress
                if (i % 10 === 0) { // Update every 10 chapters
                    this.filteredPlaylist = [...this.playlist];
                    this.renderPlaylist();
                }
            }
            console.log('All chapters loaded!');
            // Final render to ensure all chapters are displayed
            this.filteredPlaylist = [...this.playlist];
            this.renderPlaylist();
        }, 500);
    }

    async loadSingleChapter(chapterNumber) {
        try {
            this.showLoading()
            const response = await fetch(`https://quranapi.pages.dev/api/${chapterNumber}.json`);
            if (response.ok) {
                const data = await response.json();

                const chapter = {
                    number: data.surahNo,
                    name: data.surahName,
                    nameArabic: data.surahNameArabic,
                    nameArabicLong: data.surahNameArabicLong,
                    translation: data.surahNameTranslation,
                    totalAyah: data.totalAyah,
                    revelationPlace: data.revelationPlace,
                    audioUrls: data.audio || {},
                    ayahs: data.arabic1 || [],
                    duration: '00:00',
                    loaded: true
                };

                // Add or update chapter in playlist
                const existingIndex = this.playlist.findIndex(ch => ch.number === chapterNumber);
                if (existingIndex !== -1) {
                    this.playlist[existingIndex] = chapter;
                } else {
                    this.playlist.push(chapter);
                }

                // Sort playlist by chapter number
                this.playlist.sort((a, b) => a.number - b.number);

                // Update filtered playlist and re-render if we have significant progress
                if (this.playlist.length % 5 === 0 || this.playlist.length >= 114) {
                    this.filteredPlaylist = [...this.playlist];
                    this.renderPlaylist();
                }

                return chapter;
            }
        } catch (error) {
            console.error(`Error loading chapter ${chapterNumber}:`, error);
            // Add placeholder chapter if API fails
            if (!this.playlist.find(ch => ch.number === chapterNumber)) {
                this.playlist.push({
                    number: chapterNumber,
                    name: `سورة ${chapterNumber}`,
                    nameArabic: `سورة ${chapterNumber}`,
                    duration: '00:00',
                    loaded: false,
                    error: true
                });
            }
        }
        finally {
            this.hideLoading()
        }
        return null;
    }

    showSurahText(chapterNumber) {
        const chapter = this.playlist.find(ch => ch.number === chapterNumber);

        if (!chapter || !chapter.ayahs) {
            this.showError('نص السورة غير متاح');
            return;
        }

        this.modalTitle.textContent = `${chapter.nameArabic} - ${chapter.name}`;

        let content = '';
        chapter.ayahs.forEach((ayah, index) => {
            content += `<div class="verse">
                <span class="verse-text">${ayah}</span>
                <span class="verse-number">${this.toArabicNumerals(index + 1)}</span>
            </div>`;
        });

        this.modalContent.innerHTML = content;
        this.surahModal.style.display = 'flex';
    }


    showCurrentSurahText() {
        if (this.playlist.length > 0 && this.currentTrackIndex >= 0) {
            const currentTrack = this.playlist[this.currentTrackIndex];
            if (currentTrack) {
                this.showSurahText(currentTrack.number);
            }
        } else {
            this.showError('لا توجد سورة قيد التشغيل حالياً');
        }
    }

    async showMushaf() {
        this.mushaf.style.display = 'block';
        this.mushafText.innerHTML = '<div class="loading">جاري تحميل المصحف...</div>';

        let mushafContent = '';
        let currentChapterFound = false;

        for (let i = 1; i <= 114; i++) {
            const chapter = this.playlist.find(ch => ch.number === i);
            if (chapter && chapter.ayahs) {
                const isCurrentChapter = i === this.playlist[this.currentTrackIndex]?.number;

                mushafContent += `
                    <div class="mushaf-chapter" ${isCurrentChapter ? 'id="current-mushaf-chapter"' : ''}>
                        <div class="mushaf-chapter-header">
                            ${this.toArabicNumerals(chapter.number)} -  ${chapter.nameArabic}
                        </div>
                        <div class="mushaf-chapter-content">
                `;

                chapter.ayahs.forEach((ayah, index) => {
                    const isCurrentAyah = isCurrentChapter && index === this.currentAyahIndex;
                    mushafContent += `
                        <span class="mushaf-verse ${isCurrentAyah ? 'current-ayah' : ''}" data-chapter="${i}" data-ayah="${index}">${ayah}</span>
                        <span class="mushaf-verse-number cursor-pointer" data-chapter="${i}" data-ayah="${index}" onclick="player.setCurrentAyah(${i}, ${index})">${this.toArabicNumerals(index + 1)}</span>
                    `;
                });

                mushafContent += `
                        </div>
                    </div>
                `;

                if (isCurrentChapter) currentChapterFound = true;
            }
        }

        this.mushafText.innerHTML = mushafContent;

        // Scroll to current chapter after content loads
        if (currentChapterFound) {
            setTimeout(() => {
                const currentChapter = document.getElementById('current-mushaf-chapter');
                if (currentChapter) {
                    currentChapter.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }

    closeMushaf() {
        this.mushaf.style.display = 'none';
    }

    increaseFontSize() {
        this.fontSize = Math.min(this.fontSize + 2, 100);
        document.documentElement.style.fontSize = this.fontSize + 'px';
        this.savePlayerState();
    }

    decreaseFontSize() {
        this.fontSize = Math.max(this.fontSize - 2, 12);
        document.documentElement.style.fontSize = this.fontSize + 'px';
        this.savePlayerState();
    }

    setCurrentAyah(chapterNumber, ayahIndex) {
        // Find the chapter in playlist
        const chapterIndex = this.playlist.findIndex(ch => ch.number === chapterNumber);
        if (chapterIndex !== -1) {
            this.currentTrackIndex = chapterIndex;
            this.currentAyahIndex = ayahIndex;

            console.log(`Set current position: Chapter ${chapterNumber}, Ayah ${this.toArabicNumerals(ayahIndex + 1)}`);

            // Remove previous highlights immediately
            document.querySelectorAll('.current-ayah').forEach(el => {
                el.classList.remove('current-ayah');
            });

            // Add highlight to clicked ayah immediately
            const clickedAyah = document.querySelector(`[data-chapter="${chapterNumber}"][data-ayah="${ayahIndex}"].mushaf-verse`);
            if (clickedAyah) {
                clickedAyah.classList.add('current-ayah');
            }

            // Save state
            this.savePlayerState();
        }
    }

    toArabicNumerals(number) {
        return number.toString().replace(/\d/g, d =>
            String.fromCharCode(0x0660 + Number(d))
        );
    }

    refreshMushafHighlight() {
        // Remove previous highlights
        document.querySelectorAll('.current-ayah').forEach(el => {
            el.classList.remove('current-ayah');
        });

        // Add highlight to new current ayah
        const currentChapter = this.playlist[this.currentTrackIndex];
        if (currentChapter) {
            const ayahElement = document.querySelector(`[data-chapter="${currentChapter.number}"][data-ayah="${this.currentAyahIndex}"].mushaf-verse`);
            if (ayahElement) {
                ayahElement.classList.add('current-ayah');
            }
        }
    }

    savePlayerState() {
        try {
            const state = {
                currentTrackIndex: this.currentTrackIndex,
                currentReciter: this.currentReciter,
                volume: this.volumeSlider?.value || 70,
                isAutoplay: this.isAutoplay,
                isRepeatMode: this.isRepeatMode,
                currentTime: this.audioPlayer?.currentTime || 0,
                currentAyahIndex: this.currentAyahIndex,
                fontSize: this.fontSize
            };
            localStorage.setItem('quranPlayerState', JSON.stringify(state));
            // console.log('Player state saved:', state);
        } catch (error) {
            console.error('Error saving player state:', error);
        }
    }

    loadPlayerState() {
        try {
            const savedState = localStorage.getItem('quranPlayerState');
            console.log('Loading saved state:', savedState);

            if (savedState) {
                const state = JSON.parse(savedState);
                console.log('Parsed state:', state);

                // Restore player state immediately
                this.currentTrackIndex = state.currentTrackIndex || 0;
                this.currentReciter = state.currentReciter || '1';
                this.isAutoplay = state.isAutoplay !== undefined ? state.isAutoplay : true;
                this.isRepeatMode = state.isRepeatMode || false;
                this.currentAyahIndex = state.currentAyahIndex || 0;
                this.fontSize = state.fontSize || 16;

                // Apply saved font size
                document.documentElement.style.fontSize = this.fontSize + 'px';

                console.log('Restored values:', {
                    currentTrackIndex: this.currentTrackIndex,
                    currentReciter: this.currentReciter,
                    isAutoplay: this.isAutoplay,
                    isRepeatMode: this.isRepeatMode,
                    currentAyahIndex: this.currentAyahIndex
                });

                // Update UI elements immediately
                if (this.volumeSlider && state.volume) {
                    this.volumeSlider.value = state.volume;
                    this.setVolume(state.volume);
                }

                if (this.reciterSelect && state.currentReciter) {
                    this.reciterSelect.value = state.currentReciter;
                }

                if (this.autoplayToggle) {
                    this.autoplayToggle.classList.toggle('active', this.isAutoplay);
                }

                if (this.repeatBtn) {
                    this.repeatBtn.classList.toggle('active', this.isRepeatMode);
                }

                // Load the saved track if playlist is ready
                if (this.playlist.length > 0) {
                    console.log('Loading track at index:', this.currentTrackIndex);
                    this.loadCurrentTrack();
                    this.updatePlaylistUI();

                    // Restore playback position if available
                    if (state.currentTime && state.currentTime > 0) {
                        setTimeout(() => {
                            this.audioPlayer.currentTime = state.currentTime;
                        }, 1000);
                    }
                } else {
                    console.log('Playlist not ready yet, state will be applied when playlist loads');
                }
            } else {
                console.log('No saved state found');
            }
        } catch (error) {
            console.error('Error loading player state:', error);
        }
    }

    setupEventListeners() {
        // Audio player events
        this.audioPlayer.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
        this.audioPlayer.addEventListener('ended', () => this.handleTrackEnd());
        this.audioPlayer.addEventListener('loadstart', () => this.showLoading());
        this.audioPlayer.addEventListener('canplay', () => this.hideLoading());
        this.audioPlayer.addEventListener('error', (e) => this.handleAudioError(e));

        // Control buttons
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.prevBtn.addEventListener('click', () => this.previousTrack());
        this.nextBtn.addEventListener('click', () => this.nextTrack());
        this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        this.autoplayToggle.addEventListener('click', () => this.toggleAutoplay());
        this.playAllBtn.addEventListener('click', () => this.playAll());

        // Show current surah text button
        if (this.showSurahTextBtn) {
            this.showSurahTextBtn.addEventListener('click', () => this.showCurrentSurahText());
        }

        // Mushaf buttons
        if (this.mushafClose) {
            this.mushafClose.addEventListener('click', () => this.closeMushaf());
        }

        if (this.showMushafBtn) {
            this.showMushafBtn.addEventListener('click', () => this.showMushaf());
        }

        // Font zoom controls
        if (this.fontIncreaseBtn) {
            this.fontIncreaseBtn.addEventListener('click', () => this.increaseFontSize());
        }

        if (this.fontDecreaseBtn) {
            this.fontDecreaseBtn.addEventListener('click', () => this.decreaseFontSize());
        }

        // Volume control
        this.volumeSlider.addEventListener('input', (e) => {
            this.setVolume(e.target.value);
            this.savePlayerState();
        });

        // Progress bar
        this.progressBar.addEventListener('click', (e) => this.seekTo(e));

        // Search functionality
        this.searchInput.addEventListener('input', (e) => this.filterPlaylist(e.target.value));

        // Reciter selection
        if (this.reciterSelect) {
            this.reciterSelect.addEventListener('change', async (e) => {
                this.currentReciter = e.target.value;
                console.log(`Reciter changed to: ${this.currentReciter}`);
                await this.loadCurrentTrack();
                this.savePlayerState();
            });
        }

        // Modal events
        if (this.closeModal) {
            this.closeModal.addEventListener('click', () => {
                this.surahModal.style.display = 'none';
            });
        }

        if (this.surahModal) {
            this.surahModal.addEventListener('click', (e) => {
                if (e.target === this.surahModal) {
                    this.surahModal.style.display = 'none';
                }
            });
        }

        // View toggle
        if (this.viewToggle) {
            this.viewToggle.addEventListener('click', () => {
                const currentTrack = this.playlist[this.currentTrackIndex];
                if (currentTrack) {
                    this.showSurahText(currentTrack.number);
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    renderPlaylist() {
        this.playlistContainer.innerHTML = '';

        if (!this.filteredPlaylist) {
            this.filteredPlaylist = [...this.playlist];
        }

        this.filteredPlaylist.forEach((track, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'playlist-item';
            listItem.dataset.index = this.playlist.indexOf(track);

            if (this.playlist.indexOf(track) === this.currentTrackIndex) {
                listItem.classList.add('active');
                if (this.isPlaying) {
                    listItem.classList.add('playing');
                }
            }

            listItem.innerHTML = `
            <div class="surah-info">
                <div class="surah-number">${this.toArabicNumerals(track.number)}</div>
                <div class="surah-name">${track.nameArabic}</div>
            </div>
            <div class="surah-actions">
                <button class="view-text-btn" onclick="player.showSurahText(${track.number})" title="عرض النص">
                    <i class="fas fa-book-open"></i>
                    </button>
                    <div class="play-indicator">
                        <i class="fas fa-volume-up"></i>
                    </div>
                </div>
            `;

            listItem.addEventListener('click', (e) => {
                // Prevent click if clicking on the view text button
                if (e.target.closest('.view-text-btn')) {
                    return;
                }

                this.currentTrackIndex = parseInt(listItem.dataset.index);
                this.loadCurrentTrack();
                this.play();
            });

            this.playlistContainer.appendChild(listItem);
        });
    }

    async loadCurrentTrack() {
        const currentTrack = this.playlist[this.currentTrackIndex];
        if (!currentTrack || !currentTrack.audioUrls) return;

        // Get audio URL for current reciter
        const audioUrl = currentTrack.audioUrls[this.currentReciter];

        if (audioUrl?.originalUrl) {
            this.audioPlayer.src = audioUrl.originalUrl;
            console.log(`Playing: ${currentTrack.nameArabic} - Reciter: ${this.reciters[this.currentReciter] || this.currentReciter}`);
        } else {
            this.showError(`لا يوجد تسجيل صوتي متاح للقارئ المحدد`);
            return;
        }

        // Update display
        this.currentSurahName.textContent = currentTrack.nameArabic || currentTrack.name;
        if (this.currentSurahInfo) {
            this.currentSurahInfo.textContent = `السورة رقم ${this.toArabicNumerals(currentTrack.number)}`;
        }

        this.updatePlaylistUI();
    }

    async loadTrackDuration() {
        try {
            await new Promise((resolve, reject) => {
                this.audioPlayer.addEventListener('loadedmetadata', resolve, { once: true });
                this.audioPlayer.addEventListener('error', reject, { once: true });
            });
        } catch (error) {
            console.error('Error loading track duration:', error);
        }
    }

    updatePlaylistUI() {
        const playlistItems = document.querySelectorAll('.playlist-item');
        playlistItems.forEach((item, index) => {
            const trackIndex = parseInt(item.dataset.index);
            item.classList.remove('active', 'playing');

            if (trackIndex === this.currentTrackIndex) {
                item.classList.add('active');
                if (this.isPlaying) {
                    item.classList.add('playing');
                }
            }
        });
    }

    play() {
        this.audioPlayer.play()
            .then(() => {
                this.isPlaying = true;
                this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                this.updatePlaylistUI();
            })
            .catch(error => {
                console.error('Error playing audio:', error);
                this.handleAudioError(error);
            });
    }

    pause() {
        this.audioPlayer.pause();
        this.isPlaying = false;
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.updatePlaylistUI();
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            if (!this.audioPlayer.src) {
                this.loadCurrentTrack();
            }
            this.play();
        }
    }

    nextTrack() {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
        this.loadCurrentTrack();
        this.savePlayerState();
        if (this.isPlaying) {
            this.play();
        }
    }

    previousTrack() {
        this.currentTrackIndex = this.currentTrackIndex === 0
            ? this.playlist.length - 1
            : this.currentTrackIndex - 1;
        this.loadCurrentTrack();
        this.savePlayerState();
        if (this.isPlaying) {
            this.play();
        }
    }


    handleTrackEnd() {
        if (this.isRepeatMode) {
            this.audioPlayer.currentTime = 0;
            this.play();
        } else if (this.isAutoplay) {
            if (this.currentTrackIndex < this.playlist.length - 1) {
                this.nextTrack();
            } else {
                this.pause();
            }
        } else {
            this.pause();
        }
    }


    toggleRepeat() {
        this.isRepeatMode = !this.isRepeatMode;
        this.repeatBtn.classList.toggle('active', this.isRepeatMode);
        this.audioPlayer.currentTime = 0;
        this.savePlayerState();
    }

    toggleAutoplay() {
        this.isAutoplay = !this.isAutoplay;
        this.autoplayToggle.classList.toggle('active', this.isAutoplay);
        this.savePlayerState();
    }

    playAll() {
        this.currentTrackIndex = 0;
        this.loadCurrentTrack();
        this.play();
    }


    setVolume(value) {
        this.audioPlayer.volume = value / 100;
    }

    updateProgress() {
        if (this.audioPlayer.duration) {
            const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
            this.progressFill.style.width = `${progress}%`;
            this.progressHandle.style.right = `${progress}%`;

            this.currentTime.textContent = this.formatTime(this.audioPlayer.currentTime);
        }
    }

    updateDuration() {
        if (this.audioPlayer.duration) {
            this.duration.textContent = this.formatTime(this.audioPlayer.duration);

            // Update duration in playlist
            const currentTrack = this.playlist[this.currentTrackIndex];
            if (currentTrack) {
                currentTrack.duration = this.formatTime(this.audioPlayer.duration);
                this.renderPlaylist();
            }
        }
    }

    seekTo(event) {
        const rect = this.progressBar.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const width = rect.width;
        // For RTL, calculate from right side
        const percentage = (width - clickX) / width;

        if (this.audioPlayer.duration) {
            this.audioPlayer.currentTime = percentage * this.audioPlayer.duration;
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    filterPlaylist(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredPlaylist = [...this.playlist];
        } else {
            this.filteredPlaylist = this.playlist.filter(track =>
                track.name.includes(searchTerm) ||
                track.number.toString().includes(searchTerm)
            );
        }
        this.renderPlaylist();
    }

    handleKeyboardShortcuts(event) {
        switch (event.code) {
            case 'Space':
                event.preventDefault();
                this.togglePlayPause();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextTrack();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.previousTrack();
                break;
            case 'ArrowUp':
                event.preventDefault();
                const currentVolume = Math.min(100, this.volumeSlider.value + 10);
                this.volumeSlider.value = currentVolume;
                this.setVolume(currentVolume);
                break;
            case 'ArrowDown':
                event.preventDefault();
                const newVolume = Math.max(0, this.volumeSlider.value - 10);
                this.volumeSlider.value = newVolume;
                this.setVolume(newVolume);
                break;
        }
    }

    showLoading() {
        // Show loading indicator without disabling playlist
        document.getElementById('loading-indicator').style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loading-indicator').style.display = 'none';
    }

    handleAudioError(error) {
        console.error('Audio error:', error);
        this.showError('خطأ في تحميل الملف الصوتي');
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            font-family: 'Amiri', serif;
        `;
        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    // Initialize the app
    init() {
        this.renderPlaylist();
        this.setVolume(70); // Set default volume to 70%

        // Load first track by default
        if (this.playlist.length > 0) {
            this.loadCurrentTrack();
        }
    }
}

// Global player instance
let player;

// Initialize the Quran Player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    player = new QuranPlayer();
    player.init();
});
