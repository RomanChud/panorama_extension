<template>
  <div class="panorama-viewer">
    <div class="panorama-header">
      <span class="title">{{ title }}</span>
      <button class="close-btn" @click="close">✕</button>
    </div>
    <div ref="panoramaContainer" class="panorama-container" />
  </div>
</template>

<script>
export default {
  name: 'PanoramaViewer',
  props: {
    imageUrl: {
      type: String,
      required: true
    },
    title: {
      type: String,
      default: 'Панорама 360°'
    }
  },
  data() {
    return {
      viewer: null
    };
  },
  mounted() {
    this.loadPannellum();
  },
  beforeDestroy() {
    this.destroyPanorama();
  },
  watch: {
    imageUrl(newUrl) {
      if (newUrl && this.viewer) {
        this.viewer.loadScene({ panorama: newUrl });
      } else if (newUrl) {
        this.initPanorama();
      }
    }
  },
  methods: {
    loadPannellum() {
      if (window.pannellum) {
        this.initPanorama();
        return;
      }

      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';
      document.head.appendChild(cssLink);

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
      script.onload = () => {
        console.log('Pannellum загружен');
        this.initPanorama();
      };
      script.onerror = () => {
        console.error('Ошибка загрузки Pannellum');
        alert('Не удалось загрузить плеер панорам');
      };
      document.head.appendChild(script);
    },

    initPanorama() {
      if (!this.$refs.panoramaContainer) {
        console.warn('Контейнер не найден');
        return;
      }

      if (!window.pannellum) {
        console.error('Pannellum не загружен');
        return;
      }

      try {
        this.viewer = window.pannellum.viewer(this.$refs.panoramaContainer, {
          type: 'equirectangular',
          panorama: this.imageUrl,
          autoLoad: true,
          autoRotate: 2,
          compass: true,
          showControls: true,
          mouseZoom: true,
          draggable: true,
          title: this.title
        });

        this.viewer.on('error', (err) => {
          console.error('Ошибка панорамы:', err);
          alert('Не удалось загрузить панораму');
        });

        console.log('Панорама загружена');
      } catch (error) {
        console.error('Ошибка инициализации:', error);
      }
    },

    destroyPanorama() {
      if (this.viewer) {
        try {
          this.viewer.destroy?.();
        } catch (e) {
          console.warn('Ошибка при уничтожении:', e);
        }
        this.viewer = null;
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

.panorama-viewer {
  width: 100%;
  height: 100%;
  background: #0a0a0a;
  display: flex;
  flex-direction: column;
}

.panorama-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 20px;
  height: 30px;
  min-height: 30px;
  background: rgba(70, 36, 103, 0.81);
  border-bottom: 2px solid #76528a;
  flex-shrink: 0;
  z-index: 10;
}

.panorama-header .title {
  color: #ffffff;
  font-size: 22px;
  font-weight: 700;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
}

.close-btn {
  background: none;
  border: none;
  color: #ffffff;
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

.panorama-container {
  flex: 1;
  width: 100%;
  min-height: 0;
}
</style>