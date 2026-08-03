<template>
  <div v-if="imageUrl" class="panorama-viewer">
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
    },
    pointId: {
      type: String,
      default: null
    },
    initialAzimuth: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      viewer: null,
      updateTimer: null,
      lastYaw: null,
      currentAzimuth: this.initialAzimuth
    };
  },
  mounted() {
    this.loadPannellum();
  },
  beforeDestroy() {
    this.destroyPanorama();
  },
  watch: {
    imageUrl: {
      handler(newUrl, oldUrl) {
        if (newUrl && newUrl !== oldUrl) {
          this.lastYaw = null;
          this.currentAzimuth = this.initialAzimuth;
          this.$nextTick(() => {
            this.destroyPanorama();
            this.initPanorama();
          });
        }
      },
      immediate: true
    },
    initialAzimuth: {
      handler(val) {
        this.currentAzimuth = val;
        this.lastYaw = null;
      },
      immediate: true
    }
  },
  methods: {
    loadPannellum() {
      if (window.pannellum) {
        this.$nextTick(() => this.initPanorama());
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
        this.$nextTick(() => this.initPanorama());
      };
      script.onerror = () => {
        console.error('Ошибка загрузки Pannellum');
        alert('Не удалось загрузить плеер панорам');
      };
      document.head.appendChild(script);
    },

    initPanorama() {
      this.$nextTick(() => {
        if (!this.$refs.panoramaContainer) {
          console.warn('Контейнер не найден');
          return;
        }

        if (!window.pannellum) {
          console.error('Pannellum не загружен');
          return;
        }

        try {
          const yawRad = (this.initialAzimuth || 0) * Math.PI / 180;
          console.log('🎯 Устанавливаем yaw:', yawRad, 'радиан (', this.initialAzimuth, 'градусов)');
          
          this.viewer = window.pannellum.viewer(this.$refs.panoramaContainer, {
            type: 'equirectangular',
            panorama: this.imageUrl,
            autoLoad: true,
            autoRotate: 2,
            compass: true,
            showControls: true,
            mouseZoom: true,
            draggable: true,
            title: this.title,
            yaw: yawRad
          });

          this.viewer.on('error', (err) => {
            console.error('Ошибка панорамы:', err);
          });

          setTimeout(() => {
            if (this.viewer) {
              this.lastYaw = this.viewer.getYaw();
              this.sendAzimuth();
            }
          }, 100);

          if (this.updateTimer) {
            clearInterval(this.updateTimer);
          }
          this.updateTimer = setInterval(() => {
            this.sendAzimuth();
          }, 50);

          console.log('✅ Панорама загружена с азимутом:', this.initialAzimuth);
        } catch (error) {
          console.error('❌ Ошибка инициализации:', error);
        }
      });
    },

    sendAzimuth() {
      if (!this.viewer || this.lastYaw === null) return;
      
      try {
        const currentYaw = this.viewer.getYaw();
        let delta = currentYaw - this.lastYaw;
        let deltaDeg = ((delta + 180) % 360) - 180;
        
        let newAzimuth = this.initialAzimuth + deltaDeg;
        newAzimuth = ((newAzimuth % 360) + 360) % 360;
        
        if (Math.abs(newAzimuth - this.currentAzimuth) > 0.1) {
          this.currentAzimuth = newAzimuth;
          this.$emit('azimuth-update', {
            pointId: this.pointId,
            azimuth: newAzimuth
          });
        }
      } catch (e) {
        console.error('Ошибка getYaw:', e);
      }
    },

    destroyPanorama() {
      if (this.updateTimer) {
        clearInterval(this.updateTimer);
        this.updateTimer = null;
      }
      if (this.viewer) {
        try {
          const container = this.$refs.panoramaContainer;
          if (container) {
            container.innerHTML = '';
          }
          this.viewer.destroy?.();
        } catch (e) {}
        this.viewer = null;
      }
      this.lastYaw = null;
    },

    close() {
      this.destroyPanorama();
      this.$emit('close');
    }
  }
};
</script>

<style scoped>
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