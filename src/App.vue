<template>
  <div id="panorama-app">
    <div class="head">
      <h1>Фото-360</h1>
      <button class="selection-button" @click="openSelectedBlock">Выбрать</button>
    </div>
    <div class="display">
      <PanoramaBrowser 
        v-if="showBrowser" 
        :objectsRepository="objectsRepository"
        :isMobile="isMobile"
        @close="showBrowser = false"
        @open-plan="openPlan"
      />
      
      <PlanViewer
        v-if="showPlan"
        ref="planViewer"
        :key="planFolderId"
        :folderId="planFolderId"
        :folderName="planFolderName"
        :allVersions="allVersions"
        :objectsRepository="objectsRepository"
        :initialVisible="true"
        :currentAzimuth="currentAzimuth"
        :activePointId="activePointId"
        :isMobile="isMobile"
        @close="showPlan = false"
        @open-panorama="openPanorama"
        @switch-plan="onSwitchPlan"
      />
      
      <PanoramaViewer 
        v-if="showViewer" 
        :key="panoramaUrl"
        :imageUrl="panoramaUrl" 
        :title="panoramaTitle"
        :pointId="activePointId"
        :initialAzimuth="initialAzimuth"
        :isMobile="isMobile"
        :pointInfo="pointInfo"
        @close="closeViewer"
        @azimuth-update="onAzimuthUpdate"
        class="panoramaViewer"
      />

      
      <p v-if="!showBrowser && !showPlan && !showViewer" class="placeholder-text">
        Выберите панораму
      </p>
    </div>
  </div>
</template>

<script>
import PanoramaBrowser from './components/PanoramaBrowser.vue';
import PanoramaViewer from './components/PanoramaViewer.vue';
import PlanViewer from './components/PlanViewer.vue';

export default {
  components: {
    PanoramaBrowser,
    PanoramaViewer,
    PlanViewer
  },
  props: {
    objectsRepository: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      showBrowser: false,
      showPlan: false,
      showViewer: false,
      
      planFolderId: '',
      planFolderName: '',
      allVersions: [],
      
      panoramaUrl: '',
      panoramaTitle: '',
      activePointId: null,
      currentAzimuth: 0,
      initialAzimuth: 0,
      pointInfo: '',
      
      isMobile: false
    };
  },
  mounted() {
    this.checkMobile();
    window.addEventListener('resize', this.checkMobile);
    console.log('New version!')
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.checkMobile);
  },
  methods: {
    checkMobile() {
      this.isMobile = window.innerWidth <= 768 || window.innerHeight <= 600;
    },
    
    openSelectedBlock() {
      this.showBrowser = true;
      this.showPlan = false;
      this.showViewer = false;
    },
    
    openPlan(data) {
      this.showBrowser = false;
      this.showPlan = true;
      this.planFolderId = data.folderId;
      this.planFolderName = data.folderName;
      this.allVersions = data.allVersions || [];
    },
    
    openPanorama(data) {
      console.log('📥 openPanorama data:', data);
      
      this.showViewer = true;
      this.panoramaUrl = data.url;
      this.panoramaTitle = data.title || 'Панорама 360°';
      this.activePointId = data.id || null;
      this.currentAzimuth = data.azimuth || 0;
      this.initialAzimuth = data.azimuth || 0;
      
      let info = [];
      if (data.height) {
        info.push(`Высота: ${data.height}`);
        console.log('📏 Высота:', data.height);
      }
      if (data.date) {
        const d = new Date(data.date);
        info.push(d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }));
        console.log('📅 Дата:', d);
      } else if (data.year) {
        info.push(`${data.year}`);
        console.log('📅 Год:', data.year);
      }
      this.pointInfo = info.join(' | ');
      console.log('📌 pointInfo:', this.pointInfo);
    },
    
    closeViewer() {
      this.showViewer = false;
      this.panoramaUrl = '';
      this.panoramaTitle = '';
      this.activePointId = null;
      this.currentAzimuth = 0;
      this.initialAzimuth = 0;
    },
    
    onAzimuthUpdate({ pointId, azimuth }) {
      if (pointId === this.activePointId) {
        this.currentAzimuth = azimuth;
      }
    },
    
    onSwitchPlan(planId) {
      const plan = this.allVersions.find(v => v.id === planId);
      if (plan) {
        this.planFolderId = planId;
        this.planFolderName = plan.name || plan.title || 'План';
      } else {
        this.planFolderId = planId;
      }
    }
  }
};
</script>

<style>
@font-face {
  font-family: 'GPN_DIN Condensed Bold';
  src: url('@/assets/fonts/gpn_din-condensed-bold.ttf') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

#panorama-app {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  text-align: center;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  box-sizing: border-box;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
}

.head {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 40px;
  padding-left: 20px;
  padding-right: 20px;
  background: rgba(70, 36, 103, 0.81);
  flex-shrink: 0;
  z-index: 100;
}

h1 {
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 24px;
  line-height: 120%;
  display: flex;
  align-items: center;
  text-align: center;
  color: #FFFFFF;
}

.selection-button {
  text-align: center;
  width: 10%;
  height: 80%;
  border: 1px solid #3a0135;
  color: #FFFFFF;
  background-color: #76528a;
  font-size: 1.5vw;
  cursor: pointer;
}

.selection-button:active {
  background: linear-gradient(to bottom, #edebee, #a89eb5);
}

.selection-button:hover {
  box-shadow: 5px 5px 7px #770c67;
}

.display {
  height: calc(100% - 40px);
  width: 100%;
  display: flex;
  position: relative;
  overflow: hidden;
  justify-content: center;
  align-items: center;
}

.panoramaViewer {
  height: 100%;
  width: 100%;
}

.placeholder-text {
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: rgba(70, 36, 103, 0.81);
  text-align: center;
  margin: 0;
  padding: 0;
  letter-spacing: 2px;
  user-select: none;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0% { opacity: 0.3; }
  50% { opacity: 0.7; }
  100% { opacity: 0.3; }
}

@media (max-width: 768px) {
  #panorama-app .head {
    height: 30px;
    padding-left: 8px;
    padding-right: 8px;
  }
  
  #panorama-app h1 {
    font-size: 16px;
  }
  
  #panorama-app .selection-button {
    width: 20%;
    font-size: 12px;
    height: 70%;
  }
  
  #panorama-app .display {
    height: calc(100% - 30px);
  }
  
  .placeholder-text {
    font-size: 20px !important;
  }
}

@media (max-width: 480px) {
  #panorama-app .head {
    height: 25px;
    padding-left: 6px;
    padding-right: 6px;
  }
  
  #panorama-app h1 {
    font-size: 14px;
  }
  
  #panorama-app .selection-button {
    width: 25%;
    font-size: 10px;
    height: 60%;
  }
}
</style>

<!-- <template>
  <div id="panorama-app">
    <div class="head">
      <h1>Фото-360</h1>
      <button class="selection-button" @click="openSelectedBlock">Выбрать</button>
    </div>
    <div class="display">
      <PanoramaBrowser 
        v-if="showBrowser" 
        :objectsRepository="objectsRepository"
        :isMobile="isMobile"
        @close="showBrowser = false"
        @open-plan="openPlan"
      />
      
      <PlanViewer
        v-if="showPlan"
        ref="planViewer"
        :key="planFolderId"
        :folderId="planFolderId"
        :folderName="planFolderName"
        :allVersions="allVersions"
        :objectsRepository="objectsRepository"
        :initialVisible="true"
        :currentAzimuth="currentAzimuth"
        :activePointId="activePointId"
        :isMobile="isMobile"
        @close="showPlan = false"
        @open-panorama="openPanorama"
        @switch-plan="onSwitchPlan"
      />
      
      <PanoramaViewer 
        v-if="showViewer" 
        :key="panoramaUrl"
        :imageUrl="panoramaUrl" 
        :title="panoramaTitle"
        :pointId="activePointId"
        :initialAzimuth="initialAzimuth"
        :isMobile="isMobile"
        :pointInfo="pointInfo"
        @close="closeViewer"
        @azimuth-update="onAzimuthUpdate"
        class="panoramaViewer"
      />
      
      <p v-if="!showBrowser && !showPlan && !showViewer" class="placeholder-text">
        Выберите панораму
      </p>
    </div>
  </div>
</template>

<script>
import PanoramaBrowser from './components/PanoramaBrowser.vue';
import PanoramaViewer from './components/PanoramaViewer.vue';
import PlanViewer from './components/PlanViewer.vue';

export default {
  components: {
    PanoramaBrowser,
    PanoramaViewer,
    PlanViewer
  },
  props: {
    objectsRepository: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      showBrowser: false,
      showPlan: false,
      showViewer: false,
      
      planFolderId: '',
      planFolderName: '',
      allVersions: [],
      
      panoramaUrl: '',
      panoramaTitle: '',
      activePointId: null,
      currentAzimuth: 0,
      initialAzimuth: 0,
      pointInfo: '',
      
      isMobile: false
    };
  },
  mounted() {
    this.checkMobile();
    window.addEventListener('resize', this.checkMobile);
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.checkMobile);
  },
  methods: {
    checkMobile() {
      this.isMobile = window.innerWidth <= 768 || window.innerHeight <= 600;
    },
    
    openSelectedBlock() {
      this.showBrowser = true;
      this.showPlan = false;
      this.showViewer = false;
    },
    
    openPlan(data) {
      this.showBrowser = false;
      this.showPlan = true;
      this.planFolderId = data.folderId;
      this.planFolderName = data.folderName;
    },
    
    openPanorama(data) {
      this.showViewer = true;
      this.panoramaUrl = data.url;
      this.panoramaTitle = data.title || 'Панорама 360°';
      this.activePointId = data.id || null;
      this.currentAzimuth = data.azimuth || 0;
      this.initialAzimuth = data.azimuth || 0;
      let info = [];
      if (data.height) info.push(`Высота: ${data.height}`);
      if (data.date) {
        const d = new Date(data.date);
        info.push(d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }));
      } else if (data.year) {
        info.push(`${data.year}`);
      }
      this.pointInfo = info.join(' | ');
    },
    
    closeViewer() {
      this.showViewer = false;
      this.panoramaUrl = '';
      this.panoramaTitle = '';
      this.activePointId = null;
      this.currentAzimuth = 0;
      this.initialAzimuth = 0;
    },
    
    onAzimuthUpdate({ pointId, azimuth }) {
      if (pointId === this.activePointId) {
        this.currentAzimuth = azimuth;
      }
    }
  }
};
</script>

<style>
@font-face {
  font-family: 'GPN_DIN Condensed Bold';
  src: url('@/assets/fonts/gpn_din-condensed-bold.ttf') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

#panorama-app {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  text-align: center;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  box-sizing: border-box;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
}

.head {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 40px;
  padding-left: 20px;
  padding-right: 20px;
  background: rgba(70, 36, 103, 0.81);
  flex-shrink: 0;
  z-index: 100;
}

h1 {
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 24px;
  line-height: 120%;
  display: flex;
  align-items: center;
  text-align: center;
  color: #FFFFFF;
}

.selection-button {
  text-align: center;
  width: 10%;
  height: 80%;
  border: 1px solid #3a0135;
  color: #FFFFFF;
  background-color: #76528a;
  font-size: 1.5vw;
  cursor: pointer;
}

.selection-button:active {
  background: linear-gradient(to bottom, #edebee, #a89eb5);
}

.selection-button:hover {
  box-shadow: 5px 5px 7px #770c67;
}

.display {
  height: calc(100% - 40px);
  width: 100%;
  display: flex;
  position: relative;
  overflow: hidden;
  justify-content: center;
  align-items: center;
}

.panoramaViewer {
  height: 100%;
  width: 100%;
}

.placeholder-text {
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: rgba(70, 36, 103, 0.81);
  text-align: center;
  margin: 0;
  padding: 0;
  letter-spacing: 2px;
  user-select: none;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0% { opacity: 0.3; }
  50% { opacity: 0.7; }
  100% { opacity: 0.3; }
}

@media (max-width: 768px) {
  #panorama-app .head {
    height: 30px;
    padding-left: 8px;
    padding-right: 8px;
  }
  
  #panorama-app h1 {
    font-size: 16px;
  }
  
  #panorama-app .selection-button {
    width: 20%;
    font-size: 12px;
    height: 70%;
  }
  
  #panorama-app .display {
    height: calc(100% - 30px);
  }
  
  .placeholder-text {
    font-size: 20px !important;
  }
}

@media (max-width: 480px) {
  #panorama-app .head {
    height: 25px;
    padding-left: 6px;
    padding-right: 6px;
  }
  
  #panorama-app h1 {
    font-size: 14px;
  }
  
  #panorama-app .selection-button {
    width: 25%;
    font-size: 10px;
    height: 60%;
  }
}
</style> -->
