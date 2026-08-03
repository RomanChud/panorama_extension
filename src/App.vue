<!-- <template>
  <div id="panorama-app">
    <div class="head">
      <h1> Фото-360 </h1>
      <button class="selection-button" @click="openSelectedBlock"> Выбрать план </button>
    </div>
    <div class="display">
      <PanoramaBrowser v-if="isSelect" @isSelect="closeSelectBlock" @open-panorama="openPanorama" :objectsRepository="objectsRepository"></PanoramaBrowser>
      <PanoramaViewer v-if="showViewer" :imageUrl="panoramaUrl" :title="panoramaTitle" @close="closeViewer" class="panoramaViewer"></PanoramaViewer>
      <p v-else class="placeholder-text">Выберете панораму</p>
    </div>
  </div>
</template>

<script>
  import PanoramaBrowser from './components/PanoramaBrowser.vue';
  import PanoramaViewer from './components/PanoramaViewer.vue';

  export default {
    components: {
    PanoramaBrowser,
    PanoramaViewer
    },
    props: {
      objectsRepository: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
        isSelect: false,
        showViewer: false,
        panoramaUrl: '',
        panoramaTitle: ''
      }
    },
    mounted() {
    },
    methods: {

      openSelectedBlock() {
        this.isSelect = true;
      },

      closeSelectBlock(state) {
        this.isSelect = state;
      },

      openPanorama(data) {
        this.panoramaUrl = data.url;
        this.panoramaTitle = data.title || 'Панорама 360°';
        this.showViewer = true;
        this.isSelect = false;
      },

      closeViewer() {
        this.showViewer = false;
        this.panoramaUrl = '';
        this.panoramaTitle = '';
      }

    }
  }
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
  height: 30px;
  padding-left: 20px;
  padding-right: 20px;
  background: rgba(70, 36, 103, 0.81);
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
}

.selection-button span {
  flex: 1;
  text-align: center;
}

.selection-button:active{
  background: linear-gradient(to bottom, #edebee, #a89eb5);
}

.selection-button:hover{
  box-shadow: 5px 5px 7px #770c67;
}

.display {
  height: calc(100% - 30px);
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.panoramaViewer {
  height: 100%;
  width: 100%;
}

.placeholder-text {
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: rgba(70, 36, 103, 0.5);
  text-align: center;
  margin: 0;
  padding: 0;
  letter-spacing: 2px;
  user-select: none;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.5;
  }
}
</style> -->

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
        @close="showBrowser = false"
        @open-plan="openPlan"
      />
      
      <PlanViewer
        v-if="showPlan"
        ref="planViewer"
        :folderId="planFolderId"
        :folderName="planFolderName"
        :objectsRepository="objectsRepository"
        :initialVisible="true"
        :currentAzimuth="currentAzimuth"
        :activePointId="activePointId"
        @close="showPlan = false"
        @open-panorama="openPanorama"
      />
      
      <PanoramaViewer 
        v-if="showViewer" 
        :key="panoramaUrl"
        :imageUrl="panoramaUrl" 
        :title="panoramaTitle"
        :pointId="activePointId"
        :initialAzimuth="initialAzimuth"
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
      
      panoramaUrl: '',
      panoramaTitle: '',
      activePointId: null,
      currentAzimuth: 0,
      initialAzimuth: 0
    };
  },
  methods: {
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
      console.log('📥 Открытие панорамы, азимут:', data.azimuth);
      
      this.showViewer = true;
      this.panoramaUrl = data.url;
      this.panoramaTitle = data.title || 'Панорама 360°';
      this.activePointId = data.id || null;
      this.currentAzimuth = data.azimuth || 0;
      this.initialAzimuth = data.azimuth || 0;
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
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0% { opacity: 0.3; }
  50% { opacity: 0.7; }
  100% { opacity: 0.3; }
}
</style>
