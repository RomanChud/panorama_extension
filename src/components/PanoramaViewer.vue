<template>
  <div v-if="imageUrl" class="panorama-viewer" :class="{ 'mobile': isMobile }">
    <div class="panorama-header">
      <span class="title" v-show="showTitle">{{ title }}</span>
      <span class="title-placeholder" v-show="!showTitle">Панорама 360°</span>
      <div class="header-actions">
        <div v-if="pointInfo" class="point-info">
          <span class="point-info-text">{{ pointInfo }}</span>
        </div>
        
        <button class="title-btn" @click="toggleTitle" title="Показать/скрыть название">
          <span v-if="showTitle">👁️</span>
          <span v-else>👁️‍🗨️</span>
        </button>
        <button class="close-btn" @click="close">✕</button>
      </div>
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
    },
    isMobile: {
      type: Boolean,
      default: false
    },
    // Информация о точке (высота, год, дата)
    pointInfo: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      viewer: null,
      updateTimer: null,
      lastYaw: null,
      currentAzimuth: this.initialAzimuth,
      showTitle: false
    };
  },
  watch: {
    imageUrl: {
      handler(newUrl, oldUrl) {
        if (newUrl && newUrl !== oldUrl) {
          this.lastYaw = null;
          this.currentAzimuth = this.initialAzimuth;
          this.showTitle = false;
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
  mounted() {
    this.loadPannellum();
    window.addEventListener('orientationchange', this.onOrientationChange);
    window.addEventListener('resize', this.onResize);
  },
  beforeDestroy() {
    this.destroyPanorama();
    window.removeEventListener('orientationchange', this.onOrientationChange);
    window.removeEventListener('resize', this.onResize);
  },
  methods: {
    toggleTitle() {
      this.showTitle = !this.showTitle;
    },
    
    onOrientationChange() {
      this.$nextTick(() => {
        if (this.viewer) {
          this.viewer.resize();
        }
      });
    },
    
    onResize() {
      this.$nextTick(() => {
        if (this.viewer) {
          this.viewer.resize();
        }
      });
    },
    
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

    // initPanorama() {
    //   this.$nextTick(() => {
    //     if (!this.$refs.panoramaContainer) {
    //       console.warn('Контейнер не найден');
    //       return;
    //     }

    //     if (!window.pannellum) {
    //       console.error('Pannellum не загружен');
    //       return;
    //     }

    //     try {
    //       const yawRad = (this.initialAzimuth || 0) * Math.PI / 180;
          
    //       this.viewer = window.pannellum.viewer(this.$refs.panoramaContainer, {
    //         type: 'equirectangular',
    //         panorama: this.imageUrl,
    //         autoLoad: true,
    //         autoRotate: this.isMobile ? 0 : 2,
    //         compass: true,
    //         showControls: true,
    //         mouseZoom: true,
    //         draggable: true,
    //         yaw: yawRad
    //       });

    //       this.viewer.on('error', (err) => {
    //         console.error('Ошибка панорамы:', err);
    //       });

    //       setTimeout(() => {
    //         if (this.viewer) {
    //           this.lastYaw = this.viewer.getYaw();
    //           this.sendAzimuth();
    //         }
    //       }, 100);

    //       if (this.updateTimer) {
    //         clearInterval(this.updateTimer);
    //       }
    //       this.updateTimer = setInterval(() => {
    //         this.sendAzimuth();
    //       }, 50);

    //       console.log('✅ Панорама загружена с азимутом:', this.initialAzimuth);
    //     } catch (error) {
    //       console.error('❌ Ошибка инициализации:', error);
    //     }
    //   });
    // },

    // PanoramaViewer.vue — initPanorama

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
      
      const config = {
        type: 'equirectangular',
        panorama: this.imageUrl,
        autoLoad: true,
        autoRotate: this.isMobile ? 0 : 2,
        compass: true,
        showControls: true,
        mouseZoom: true,
        draggable: true,
        yaw: yawRad
      };
      
      if (this.isMobile) {
        // На мобильных запускаем с задержкой
        setTimeout(() => {
          try {
            this.viewer = window.pannellum.viewer(this.$refs.panoramaContainer, config);
            this.setupViewerEvents();
          } catch (e) {
            console.error('Ошибка при инициализации на мобильном:', e);
            // Пробуем еще раз
            setTimeout(() => this.initPanorama(), 1000);
          }
        }, 300);
      } else {
        this.viewer = window.pannellum.viewer(this.$refs.panoramaContainer, config);
        this.setupViewerEvents();
      }
      
    } catch (error) {
      console.error('❌ Ошибка инициализации:', error);
    }
  });
},

setupViewerEvents() {
  if (!this.viewer) return;
  
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
    // close() {
    //   this.destroyPanorama();
    //   // Очищаем blob URL если он есть
    //   if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
    //     URL.revokeObjectURL(this.imageUrl);
    //   }
    //   this.$emit('close');
    // }
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
  font-size: 18px;
  font-weight: 700;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-placeholder {
  color: rgba(255, 255, 255, 0.3);
  font-size: 18px;
  font-weight: 400;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  flex: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* ===== ИНФО О ТОЧКЕ ===== */
.point-info {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 2px 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.point-info-text {
  color: #ffffff;
  font-size: 12px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  white-space: nowrap;
}

.title-btn {
  background: none;
  border: none;
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
  line-height: 1.5;
  opacity: 0.5;
}

.title-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  opacity: 1;
}

.close-btn {
  background: none;
  border: none;
  color: #ffffff;
  font-size: 20px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  line-height: 1.5;
}

.close-btn:hover {
  background: rgba(255, 68, 68, 0.3);
}

.panorama-container {
  flex: 1;
  width: 100%;
  min-height: 0;
}

/* Мобильная версия */
.panorama-viewer.mobile .panorama-header {
  height: 25px;
  min-height: 25px;
  padding: 2px 12px;
}

.panorama-viewer.mobile .panorama-header .title {
  font-size: 14px;
}

.panorama-viewer.mobile .title-placeholder {
  font-size: 14px;
}

.panorama-viewer.mobile .close-btn {
  font-size: 18px;
  padding: 0 6px;
}

.panorama-viewer.mobile .title-btn {
  font-size: 14px;
  padding: 0 4px;
}

.panorama-viewer.mobile .point-info-text {
  font-size: 10px;
}

.panorama-viewer.mobile .point-info {
  padding: 1px 6px;
}

@media (max-width: 768px) and (orientation: landscape) {
  .panorama-viewer.mobile .panorama-header {
    height: 20px;
    min-height: 20px;
    padding: 1px 10px;
  }
  
  .panorama-viewer.mobile .panorama-header .title {
    font-size: 12px;
  }
  
  .panorama-viewer.mobile .title-placeholder {
    font-size: 12px;
  }
  
  .panorama-viewer.mobile .close-btn {
    font-size: 14px;
    padding: 0 4px;
  }
  
  .panorama-viewer.mobile .title-btn {
    font-size: 12px;
  }
  
  .panorama-viewer.mobile .point-info-text {
    font-size: 9px;
  }
  
  .panorama-viewer.mobile .point-info {
    padding: 1px 4px;
  }
}
</style>