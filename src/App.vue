<template>
  <div id="panorama-app">
    <div class="head">
      <h1> Фото-360 </h1>
      <button class="selection-button" @click="openSelectedBlock"> Выбрать план </button>
    </div>
    <div class="display">
      <PanoramaBrowser v-if="this.isSelect" @isSelect="closeSelectBlock" @open-panorama="openPanorama" :objectsRepository="objectsRepository"></PanoramaBrowser>
      <PanoramaViewer v-if="showViewer" :imageUrl="panoramaUrl" :title="panoramaTitle" @close="closeViewer" class="panoramaViewer"></PanoramaViewer>
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
  box-shadow: 5px 5px 7px #770c67
}

.display {
  height: calc(100% - 30px);
  width: 100%;
}

.panoramaViewer {
  height: 100%;
  width: 100%;
}

</style>