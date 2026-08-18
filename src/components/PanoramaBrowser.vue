<template>
  <div class="panorama-browser" id="panorama-browser" :class="{ 'mobile': isMobile }">
    <div class="header">
      <h2>{{ header }}</h2>
      <button class="close-btn" @click="close">✕</button>
    </div>
    <button v-if="canGoBack" class="back-btn" @click="goBack">← Назад</button>
    <div class="content">
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
          v-for="item in uniquePlans"
          :key="item.id"
          class="list-item"
          @click="selectFolder(item)"
        >
          <span>{{ item.name }}</span>
          <span v-if="item.versions && item.versions.length > 1" class="version-info">
            ({{ item.versions.length }})
          </span>
          <span class="arrow">→</span>
        </div>
        <div v-if="uniquePlans.length === 0" class="empty-state">
          <p>Нет папок в этой установке</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { PanoramaService } from '../services/PanoramaService';

export default {
  name: 'PanoramaBrowser',
  props: {
    objectsRepository: {
      type: Object,
      required: true
    },
    isMobile: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      installations: [],
      folders: [],
      
      currentLevel: 'installations',
      selectedInstallation: null,
      selectedFolder: null,
      header: 'Установки',
      loading: false,
      
      service: null
    };
  },
  computed: {
    canGoBack() {
      return this.currentLevel !== 'installations';
    },
    uniquePlans() {
      const uniqueMap = {};
      
      const folderName = this.selectedInstallation?.name || '';
      const isUGK = folderName.includes('УГК');
      const isOZH = folderName.includes('БДКВ') || 
                    folderName.includes('БОВ-8а') || 
                    folderName.includes('ОСВ') || 
                    folderName.includes('ХВП') || 
                    folderName.includes('ХЖА');
      
      for (const folder of this.folders) {
        const title = folder.name || '';
        if (!title || title === 'Без имени' || title === 'Source files') continue;
        
        const parsed = this.service?.parsePlanName(title, isUGK, isOZH);
        
        if (!parsed) continue;
        
        if (!parsed.baseName) {
          uniqueMap[folder.id] = {
            id: folder.id,
            name: title,
            versions: [folder],
            _raw: folder
          };
          continue;
        }
        
        const key = parsed.baseName;
        
        if (!uniqueMap[key]) {
          uniqueMap[key] = {
            id: key,
            name: key,
            versions: [],
            _raw: null
          };
        }
        
        uniqueMap[key].versions.push({
          id: folder.id,
          name: title,
          height: parsed.height,
          year: parsed.year,
          _raw: folder
        });
      }
      
      return Object.values(uniqueMap);
    }
  },
  async mounted() {
    this.service = new PanoramaService(this.objectsRepository);
    await this.loadInstallations();
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

    async enrichVersionsWithYear(versions) {
      const enriched = [];
      for (const v of versions) {
        let year = v.year;
        if (!year) {
          // Пробуем получить год из точек
          try {
            year = await this.service.getYearFromPoints(v.id);
            console.log(`📅 Год для ${v.name}: ${year}`);
          } catch (e) {
            console.warn(`Не удалось получить год для ${v.name}:`, e);
            year = null;
          }
        }
        enriched.push({
          ...v,
          year: year
        });
      }
      return enriched;
    },

    async selectFolder(item) {
      this.selectedFolder = item;
      
      let versions = item.versions || [];
      
      // ===== ВСЕГДА ПРОВЕРЯЕМ И ЗАГРУЖАЕМ ГОДЫ =====
      this.loading = true;
      try {
        // Проходим по всем версиям и загружаем годы, если их нет
        const enrichedVersions = [];
        for (const v of versions) {
          let year = v.year;
          if (!year) {
            // Пробуем получить год из точек
            year = await this.service.getYearFromPoints(v.id);
            console.log(`📅 Год для ${v.name}: ${year}`);
          }
          enrichedVersions.push({
            ...v,
            year: year
          });
        }
        versions = enrichedVersions;
      } catch (error) {
        console.error('Ошибка загрузки годов:', error);
      } finally {
        this.loading = false;
      }
      
      const firstFolder = versions.length > 0 ? versions[0] : item;
      
      console.log('📦 Передаем allVersions с годами:', versions.map(v => ({ name: v.name, year: v.year })));
      
      this.$emit('open-plan', {
        folderId: firstFolder.id,
        folderName: item.name,
        allVersions: versions
      });
      this.$emit('close');
    },

    goBack() {
      if (this.currentLevel === 'folders') {
        this.folders = [];
        this.currentLevel = 'installations';
        this.header = 'Установки';
        this.selectedInstallation = null;
      }
    },

    close() {
      this.$emit('close');
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
  border-radius: 0 0 10px 10px;
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

.list-item span:first-child {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-item:hover {
  background: #e8dff0;
  border-color: #76528a;
}

.list-item .arrow {
  color: #888;
  font-size: 18px;
}

.version-info {
  font-size: 12px;
  color: #888;
  margin-right: 8px;
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

@media (max-width: 768px) {
  .panorama-browser {
    width: 100vw !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    height: 100vh !important;
    border-radius: 0 !important;
    border: none !important;
    top: 0 !important;
    left: 0 !important;
    transform: none !important;
    margin: 0 !important;
  }
  
  .panorama-browser .header {
    border-radius: 0 !important;
    padding: 8px 12px;
  }
  
  .panorama-browser .header h2 {
    font-size: 18px;
  }
  
  .panorama-browser .content {
    max-height: 100% !important;
    min-height: 0 !important;
  }
}
</style>

<!-- <template>
  <div class="panorama-browser" id="panorama-browser" :class="{ 'mobile': isMobile }">
    <div class="header">
      <h2>{{ header }}</h2>
      <button class="close-btn" @click="close">✕</button>
    </div>
    <button v-if="canGoBack" class="back-btn" @click="goBack">← Назад</button>
    <div class="content">
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
          v-for="item in uniquePlans"
          :key="item.id"
          class="list-item"
          @click="selectFolder(item)"
        >
          <span>{{ item.name }}</span>
          <span v-if="item.versions && item.versions.length > 1" class="version-info">
            ({{ item.versions.length }})
          </span>
          <span class="arrow">→</span>
        </div>
        <div v-if="uniquePlans.length === 0" class="empty-state">
          <p>Нет папок в этой установке</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { PanoramaService } from '../services/PanoramaService';

export default {
  name: 'PanoramaBrowser',
  props: {
    objectsRepository: {
      type: Object,
      required: true
    },
    isMobile: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      installations: [],
      folders: [],
      
      currentLevel: 'installations',
      selectedInstallation: null,
      selectedFolder: null,
      header: 'Установки',
      loading: false,
      
      service: null
    };
  },
  computed: {
    canGoBack() {
      return this.currentLevel !== 'installations';
    },
    uniquePlans() {
      const uniqueMap = {};
      
      // Определяем флаги по имени выбранной установки
      const folderName = this.selectedInstallation?.name || '';
      const isUGK = folderName.includes('УГК');
      const isOZH = folderName.includes('БДКВ') || 
                    folderName.includes('БОВ-8а') || 
                    folderName.includes('ОСВ') || 
                    folderName.includes('ХВП') || 
                    folderName.includes('ХЖА');
      
      for (const folder of this.folders) {
        const title = folder.name || '';
        if (!title || title === 'Без имени' || title === 'Source files') continue;
        
        // Передаем флаги!
        const parsed = this.service?.parsePlanName(title, isUGK, isOZH);

        //ИИИИИИССССППППРАААВВВЛЕЕЕЕННННООО
        if (!parsed) continue;
        
        if (!parsed || !parsed.baseName) {
          uniqueMap[folder.id] = {
            id: folder.id,
            name: title,
            versions: [folder],
            _raw: folder
          };
          continue;
        }
        
        const key = parsed.baseName;
        
        if (!uniqueMap[key]) {
          uniqueMap[key] = {
            id: key,
            name: key,
            versions: [],
            _raw: null
          };
        }
        
        uniqueMap[key].versions.push({
          id: folder.id,
          name: title,
          height: parsed.height,
          year: parsed.year,
          _raw: folder
        });
      }
      
      return Object.values(uniqueMap);
    }
  },
  async mounted() {
    this.service = new PanoramaService(this.objectsRepository);
    await this.loadInstallations();
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

    selectFolder(item) {
      console.log('📂 selectFolder:', item);
      this.selectedFolder = item;
      
      const firstFolder = item.versions && item.versions.length > 0 
        ? item.versions[0] 
        : item;
      
      console.log('📦 Передаем allVersions:', item.versions || []);
      
      this.$emit('open-plan', {
        folderId: firstFolder.id,
        folderName: item.name,
        allVersions: item.versions || []
      });
      this.$emit('close');
    },

    goBack() {
      if (this.currentLevel === 'folders') {
        this.folders = [];
        this.currentLevel = 'installations';
        this.header = 'Установки';
        this.selectedInstallation = null;
      }
    },

    close() {
      this.$emit('close');
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
  border-radius: 0 0 10px 10px;
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

.list-item span:first-child {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-item:hover {
  background: #e8dff0;
  border-color: #76528a;
}

.list-item .arrow {
  color: #888;
  font-size: 18px;
}

.version-info {
  font-size: 12px;
  color: #888;
  margin-right: 8px;
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

/* Мобильная версия */
@media (max-width: 768px) {
  .panorama-browser {
    width: 100vw !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    height: 100vh !important;
    border-radius: 0 !important;
    border: none !important;
    top: 0 !important;
    left: 0 !important;
    transform: none !important;
    margin: 0 !important;
  }
  
  .panorama-browser .header {
    border-radius: 0 !important;
    padding: 8px 12px;
  }
  
  .panorama-browser .header h2 {
    font-size: 18px;
  }
  
  .panorama-browser .content {
    max-height: 100% !important;
    min-height: 0 !important;
  }
}
</style> -->

<!-- <template>
  <div class="panorama-browser" id="panorama-browser" :class="{ 'mobile': isMobile }">
    <div class="header">
      <h2>{{ header }}</h2>
      <button class="close-btn" @click="close">✕</button>
    </div>
    <button v-if="canGoBack" class="back-btn" @click="goBack">← Назад</button>
    <div class="content">
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
    </div>
  </div>
</template>

<script>
import { PanoramaService } from '../services/PanoramaService';

export default {
  name: 'PanoramaBrowser',
  props: {
    objectsRepository: {
      type: Object,
      required: true
    },
    isMobile: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      installations: [],
      folders: [],
      
      currentLevel: 'installations',
      selectedInstallation: null,
      selectedFolder: null,
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
    this.service = new PanoramaService(this.objectsRepository);
    await this.loadInstallations();
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

    selectFolder(item) {
      this.selectedFolder = item;
      this.$emit('open-plan', {
        folderId: item.id,
        folderName: item.name
      });
      this.$emit('close');
    },

    goBack() {
      if (this.currentLevel === 'folders') {
        this.folders = [];
        this.currentLevel = 'installations';
        this.header = 'Установки';
        this.selectedInstallation = null;
      }
    },

    close() {
      this.$emit('close');
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
  border-radius: 0 0 10px 10px;
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

@media (max-width: 768px) {
  .panorama-browser {
    width: 100vw !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    height: 100vh !important;
    border-radius: 0 !important;
    border: none !important;
    top: 0 !important;
    left: 0 !important;
    transform: none !important;
    margin: 0 !important;
  }
  
  .panorama-browser .header {
    border-radius: 0 !important;
    padding: 8px 12px;
  }
  
  .panorama-browser .header h2 {
    font-size: 18px;
  }
  
  .panorama-browser .content {
    max-height: 100% !important;
    min-height: 0 !important;
  }
}
</style> -->