<!-- <template>
  <div class="panorama-browser" id="panorama-browser">
    <div class="header">
      <h2>{{ header }}</h2>
      <button class="close-btn" @click="close">✕</button>
    </div>
    <button v-if="canGoBack" class="back-btn" @click="goBack">← Назад</button>
    <div class="content">
      <div v-if="currentLevel === 'installations'" class="list">
        <div
          v-for="item in installations"
          :key="item.id"
          class="list-item"
          @click="selectInstallation(item)"
        >
          <span>{{ item.name }}</span>
          <span class="arrow">→</span>
        </div>
        <div v-if="installations.length === 0" class="empty-state">
          <p>Нет доступных установок</p>
        </div>
      </div>
      <div v-else-if="currentLevel === 'folders'" class="list">
        <div
          v-for="item in folders"
          :key="item.id"
          class="list-item"
          @click="selectFolder(item)"
        >
          <span>{{ item.name }}</span>
          <span class="arrow">→</span>
        </div>
        <div v-if="folders.length === 0" class="empty-state">
          <p>Нет папок в этой установке</p>
        </div>
      </div>
      <div v-else-if="currentLevel === 'photos'" class="list">
        <div
          v-for="item in photos"
          :key="item.id"
          class="list-item"
          :class="{ selected: selectedPhoto && selectedPhoto.id === item.id }"
          @click="selectPhoto(item)"
        >
          <span>{{ item.name }}</span>
          <span v-if="selectedPhoto && selectedPhoto.id === item.id" class="check">✓</span>
          <span v-else class="arrow">→</span>
        </div>
        <div v-if="photos.length === 0" class="empty-state">
          <p>Нет снимков в этой папке</p>
        </div>
      </div>
    </div>
    <div class="footer">
      <button
        v-if="selectedPhoto"
        class="open-btn"
        @click="openPanorama"
      >
      Открыть панораму
      </button>
      <span v-else class="hint">Выберите снимок для просмотра</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PanoramaBrowser',
  props: {
    isSelect: {
      type: Boolean,
      default: true,
    },
    installationsData: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      installations: [
        {
          id: '1',
          name: 'УПС - Установка производства серы',
          folders: [
            {
              id: '1-1',
              name: 'ГП-200',
              photos: [
                { id: '1-1-1', name: 'Панорама 1', url: 'https://pannellum.org/images/alma.jpg' },
                { id: '1-1-2', name: 'Панорама 2', url: 'https://pannellum.org/images/alma.jpg' },
                { id: '1-1-3', name: 'Панорама 3', url: 'https://pannellum.org/images/alma.jpg' }
              ]
            },
            {
              id: '1-2',
              name: 'ГП-400',
              photos: [
                { id: '1-2-1', name: 'Общий вид', url: 'https://pannellum.org/images/alma.jpg' }
              ]
            }
          ]
        },
        {
          id: '2',
          name: 'УЗК',
          folders: [
            {
              id: '2-1',
              name: 'ГexploreStructure',
              photos: [
                { id: '2-1-1', name: 'Панорама 1', url: 'https://pannellum.org/images/alma.jpg' },
                { id: '2-1-2', name: 'Панорама 2', url: 'https://pannellum.org/images/alma.jpg' }
              ]
            }
          ]
        },
        {
          id: '3',
          name: 'УПС',
          folders: [
            {
              id: '3-1',
              name: 'ГП-400',
              photos: [
                { id: '3-1-1', name: 'Панорама 1', url: 'https://pannellum.org/images/alma.jpg' }
              ]
            }
          ]
        },
        {
          id: '4',
          name: 'УПВ',
          folders: [
            {
              id: '4-1',
              name: 'ГП-500',
              photos: [
                { id: '4-1-1', name: 'Панорама 1', url: 'https://pannellum.org/images/alma.jpg' }
              ]
            }
          ]
        }
      ],
      currentLevel: 'installations',
      selectedInstallation: null,
      selectedFolder: null,
      selectedPhoto: null,
      header: 'Установки',
    };
  },
  computed: {
    folders() {
      return this.selectedInstallation ? this.selectedInstallation.folders : [];
    },
    photos() {
      return this.selectedFolder ? this.selectedFolder.photos : [];
    },
    canGoBack() {
      return this.currentLevel !== 'installations';
    }
  },
  methods: {
    selectInstallation(item) {
      this.selectedInstallation = item;
      this.selectedFolder = null;
      this.selectedPhoto = null;
      this.currentLevel = 'folders';
      this.header = 'Папки';
    },

    selectFolder(item) {
      this.selectedFolder = item;
      this.selectedPhoto = null;
      this.currentLevel = 'photos';
      this.header = 'Фото';
    },

    selectPhoto(item) {
      if (this.selectedPhoto && this.selectedPhoto.id === item.id) {
        this.selectedPhoto = null;
        return;
      }
      this.selectedPhoto = item;
    },

    goBack() {
      if (this.currentLevel === 'folders') {
        this.currentLevel = 'installations';
        this.header = 'Установки'
        this.selectedInstallation = null;
      } else if (this.currentLevel === 'photos') {
        this.currentLevel = 'folders';
        this.header = 'Папки'
        this.selectedFolder = null;
        this.selectedPhoto = null;
      }
    },

    async openPanorama() {
      if (!this.selectedPhoto) {
        console.warn('Снимок не выбран');
        return;
      }

      this.$emit('open-panorama', {
        url: this.selectedPhoto.url,
        title: this.selectedPhoto.name
      });
    },

    close() {
      this.$emit('isSelect', false);
    }
  }
};
</script>

<style scoped>
@font-face {
  font-family: 'GPN_DIN Condensed Bold';
  src: url('@/assets/fonts/gpn_din-condensed-bold.ttf') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

.panorama-browser {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  max-width: 90vw;
  max-height: 80vh;
  background: #f2f2f2;
  border-radius: 12px;
  border: 2px solid #76528a;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  z-index: 9999;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: rgba(70, 36, 103, 0.9);
  border-bottom: 2px solid #76528a;
  flex-shrink: 0;
  border-radius: 10px 10px 0 0;
}

.header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #FFFFFF;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
}

.close-btn {
  background: none;
  border: none;
  color: #FFFFFF;
  font-size: 24px;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: scale(1.1);
}

.back-btn {
  margin: 8px 16px 0;
  padding: 6px 16px;
  background: #76528a;
  border: 1px solid #3a0135;
  border-radius: 6px;
  color: #FFFFFF;
  cursor: pointer;
  font-size: 14px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  flex-shrink: 0;
  width: fit-content;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #8a6a9e;
  box-shadow: 0 0 10px rgba(118, 82, 138, 0.5);
}

.back-btn:active {
  background: linear-gradient(to bottom, #edebee, #a89eb5);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  min-height: 200px;
  max-height: 350px;
  background: #f2f2f2;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: #333;
  font-size: 16px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  border: 1px solid transparent;
}

.list-item:hover {
  background: #e8dff0;
  border-color: #76528a;
}

.list-item.selected {
  background: #76528a;
  color: #FFFFFF;
  border-color: #3a0135;
}

.list-item.selected .arrow {
  color: #FFFFFF;
}

.list-item .arrow {
  color: #888;
  font-size: 18px;
}

.list-item .check {
  color: #FFFFFF;
  font-weight: bold;
}

.empty-state {
  text-align: center;
  color: #888;
  padding: 40px 0;
  font-size: 16px;
}

.footer {
  padding: 12px 20px;
  border-top: 2px solid #76528a;
  flex-shrink: 0;
  text-align: center;
  background: #f2f2f2;
  border-radius: 0 0 10px 10px;
}

.open-btn {
  padding: 10px 28px;
  background: #76528a;
  border: 2px solid #3a0135;
  border-radius: 8px;
  color: #FFFFFF;
  font-size: 18px;
  font-weight: 700;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
}

.open-btn:hover {
  background: #8a6a9e;
  box-shadow: 0 0 15px rgba(118, 82, 138, 0.5);
  transform: scale(1.02);
}

.open-btn:active {
  background: linear-gradient(to bottom, #edebee, #a89eb5);
}

.hint {
  color: #888;
  font-size: 16px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
}

.content::-webkit-scrollbar {
  width: 6px;
}

.content::-webkit-scrollbar-track {
  background: #e0d6e8;
  border-radius: 3px;
}

.content::-webkit-scrollbar-thumb {
  background: #76528a;
  border-radius: 3px;
}

.content::-webkit-scrollbar-thumb:hover {
  background: #8a6a9e;
}
</style> -->

<template>
  <div class="panorama-browser" id="panorama-browser">
    <div class="header">
      <h2>{{ header }}</h2>
      <button class="close-btn" @click="close">✕</button>
    </div>
    <button v-if="canGoBack" class="back-btn" @click="goBack">← Назад</button>
    <div class="content">
      <!-- Загрузка -->
      <div v-if="loading" class="loading-state">
        <p>⏳ Загрузка...</p>
      </div>
      
      <div v-else-if="currentLevel === 'installations'" class="list">
        <div
          v-for="item in installations"
          :key="item.id"
          class="list-item"
          @click="selectInstallation(item)"
        >
          <span>{{ item.name }}</span>
          <span class="arrow">→</span>
        </div>
        <div v-if="installations.length === 0" class="empty-state">
          <p>Нет доступных установок</p>
        </div>
      </div>

      <div v-else-if="currentLevel === 'folders'" class="list">
        <div
          v-for="item in folders"
          :key="item.id"
          class="list-item"
          @click="selectFolder(item)"
        >
          <span>{{ item.name }}</span>
          <span class="arrow">→</span>
        </div>
        <div v-if="folders.length === 0" class="empty-state">
          <p>Нет папок в этой установке</p>
        </div>
      </div>

      <div v-else-if="currentLevel === 'photos'" class="list">
        <div
          v-for="item in photos"
          :key="item.id"
          class="list-item"
          :class="{ selected: selectedPhoto && selectedPhoto.id === item.id }"
          @click="selectPhoto(item)"
        >
          <span>{{ item.name }}</span>
          <span v-if="selectedPhoto && selectedPhoto.id === item.id" class="check">✓</span>
          <span v-else class="arrow">→</span>
        </div>
        <div v-if="photos.length === 0" class="empty-state">
          <p>Нет панорам в этой папке</p>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <button
        v-if="selectedPhoto"
        class="open-btn"
        @click="openPanorama"
      >
        Открыть панораму
      </button>
      <span v-else class="hint">Выберите панораму для просмотра</span>
    </div>
  </div>
</template>

<script>
import { PanoramaService } from '../services/PanoramaService';

export default {
  name: 'PanoramaBrowser',
  props: {
    isSelect: {
      type: Boolean,
      default: true,
    },
    objectsRepository: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      installations: [],
      folders: [],
      photos: [],
      
      currentLevel: 'installations',
      selectedInstallation: null,
      selectedFolder: null,
      selectedPhoto: null,
      header: 'Установки',
      loading: false,
      
      service: null
    };
  },
  computed: {
    canGoBack() {
      return this.currentLevel !== 'installations';
    }
  },
  async mounted() {
    console.log('🔍 PanoramaBrowser mounted');
    this.service = new PanoramaService(this.objectsRepository);
    await this.loadInstallations();
  },
  beforeDestroy() {
    if (this.service) {
      this.service.clearUrls(this.photos);
    }
  },
  methods: {
    async loadInstallations() {
      this.loading = true;
      try {
        const projects = await this.service.getProjects();
        this.installations = Object.values(projects);
      } catch (error) {
        console.error('Ошибка загрузки установок:', error);
      } finally {
        this.loading = false;
      }
    },

    async selectInstallation(item) {
      
      this.selectedInstallation = item;
      this.selectedFolder = null;
      this.selectedPhoto = null;
      this.currentLevel = 'folders';
      this.header = 'Папки';
      this.loading = true;
      
      try {
        const folders = await this.service.getFolders(item.id);
        this.folders = Object.values(folders);
      } catch (error) {
        console.error('Ошибка загрузки папок:', error);
      } finally {
        this.loading = false;
      }
    },

    async selectFolder(item) {
      console.log('Выбрана папка:', item);
      
      this.selectedFolder = item;
      this.selectedPhoto = null;
      this.currentLevel = 'photos';
      this.header = 'Панорамы';
      this.loading = true;
      
      try {
        const panorams = await this.service.getPanorams(item.id);
        this.photos = Object.values(panorams);
        console.log('Панорамы загружены:', this.photos.length);
        
        if (this.photos.length === 0) {
          console.warn('Панорамы не найдены в этой папке');
        }
      } catch (error) {
        console.error('Ошибка загрузки панорам:', error);
        alert('Не удалось загрузить панорамы. Проверьте консоль.');
      } finally {
        this.loading = false;
      }
    },

    selectPhoto(item) {
      console.log('Выбрана панорама:', item);
      
      if (this.selectedPhoto && this.selectedPhoto.id === item.id) {
        this.selectedPhoto = null;
        return;
      }
      this.selectedPhoto = item;
    },

    goBack() {
      console.log('Назад, текущий уровень:', this.currentLevel);
      
      if (this.currentLevel === 'folders') {
        this.folders = [];
        this.currentLevel = 'installations';
        this.header = 'Установки';
        this.selectedInstallation = null;
      } else if (this.currentLevel === 'photos') {
        if (this.service) {
          this.service.clearUrls(this.photos);
        }
        this.photos = [];
        this.selectedPhoto = null;
        this.currentLevel = 'folders';
        this.header = 'Папки';
        this.selectedFolder = null;
      }
    },

    // PanoramaBrowser.vue

    // ===== ОТКРЫТИЕ ПАНОРАМЫ =====
    async openPanorama() {
      console.log('Открытие панорамы');
      
      if (!this.selectedPhoto) {
        console.warn('Панорама не выбрана');
        return;
      }

      // Показываем лоадер
      this.loading = true;

      try {
        // Если URL еще не загружен - загружаем
        if (!this.selectedPhoto.url) {
          console.log('Загрузка файла панорамы...');
          const url = await this.service.loadPanoramaFile(this.selectedPhoto.id);
          if (!url) {
            alert('Не удалось загрузить изображение панорамы');
            return;
          }
          this.selectedPhoto.url = url;
        }

        this.$emit('open-panorama', {
          url: this.selectedPhoto.url,
          title: this.selectedPhoto.name || 'Панорама 360°'
        });
      } catch (error) {
        console.error('Ошибка загрузки панорамы:', error);
        alert('Не удалось загрузить панораму');
      } finally {
        this.loading = false;
      }
    },

    close() {
      if (this.service) {
        this.service.clearUrls(this.photos);
      }
      
      this.$emit('isSelect', false);
    }
  }
};
</script>

<style scoped>
@font-face {
  font-family: 'GPN_DIN Condensed Bold';
  src: url('@/assets/fonts/gpn_din-condensed-bold.ttf') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

.panorama-browser {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  max-width: 90vw;
  max-height: 80vh;
  background: #f2f2f2;
  border-radius: 12px;
  border: 2px solid #76528a;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  z-index: 9999;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: rgba(70, 36, 103, 0.9);
  border-bottom: 2px solid #76528a;
  flex-shrink: 0;
  border-radius: 10px 10px 0 0;
}

.header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #FFFFFF;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
}

.close-btn {
  background: none;
  border: none;
  color: #FFFFFF;
  font-size: 24px;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: scale(1.1);
}

.back-btn {
  margin: 8px 16px 0;
  padding: 6px 16px;
  background: #76528a;
  border: 1px solid #3a0135;
  border-radius: 6px;
  color: #FFFFFF;
  cursor: pointer;
  font-size: 14px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  flex-shrink: 0;
  width: fit-content;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #8a6a9e;
  box-shadow: 0 0 10px rgba(118, 82, 138, 0.5);
}

.back-btn:active {
  background: linear-gradient(to bottom, #edebee, #a89eb5);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  min-height: 200px;
  max-height: 350px;
  background: #f2f2f2;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: #333;
  font-size: 16px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  border: 1px solid transparent;
}

.list-item:hover {
  background: #e8dff0;
  border-color: #76528a;
}

.list-item.selected {
  background: #76528a;
  color: #FFFFFF;
  border-color: #3a0135;
}

.list-item.selected .arrow {
  color: #FFFFFF;
}

.list-item .arrow {
  color: #888;
  font-size: 18px;
}

.list-item .check {
  color: #FFFFFF;
  font-weight: bold;
}

.empty-state {
  text-align: center;
  color: #888;
  padding: 40px 0;
  font-size: 16px;
}

.loading-state {
  text-align: center;
  color: #888;
  padding: 40px 0;
  font-size: 18px;
}

.footer {
  padding: 12px 20px;
  border-top: 2px solid #76528a;
  flex-shrink: 0;
  text-align: center;
  background: #f2f2f2;
  border-radius: 0 0 10px 10px;
}

.open-btn {
  padding: 10px 28px;
  background: #76528a;
  border: 2px solid #3a0135;
  border-radius: 8px;
  color: #FFFFFF;
  font-size: 18px;
  font-weight: 700;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
}

.open-btn:hover {
  background: #8a6a9e;
  box-shadow: 0 0 15px rgba(118, 82, 138, 0.5);
  transform: scale(1.02);
}

.open-btn:active {
  background: linear-gradient(to bottom, #edebee, #a89eb5);
}

.hint {
  color: #888;
  font-size: 16px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
}

.content::-webkit-scrollbar {
  width: 6px;
}

.content::-webkit-scrollbar-track {
  background: #e0d6e8;
  border-radius: 3px;
}

.content::-webkit-scrollbar-thumb {
  background: #76528a;
  border-radius: 3px;
}

.content::-webkit-scrollbar-thumb:hover {
  background: #8a6a9e;
}
</style>