<!-- src/components/PlanViewer.vue -->
<template>
  <div 
    v-if="visible"
    class="plan-viewer"
    :style="{
      left: position.x + 'px',
      top: position.y + 'px',
      width: size.width + 'px',
      height: size.height + 'px'
    }"
  >
    <div class="plan-header" @mousedown="onHeaderMouseDown">
      <span class="plan-title">{{ planTitle }}</span>
      <div class="header-actions">
        <button class="hide-btn" @click="hidePlan" title="Скрыть план">─</button>
        <button class="close-btn" @click="close">✕</button>
      </div>
    </div>

    <div class="plan-container" ref="planContainer">
      <div v-if="loading" class="loading-overlay">
        <div class="spinner"></div>
      </div>
      
      <div v-else-if="planImageUrl" class="plan-wrapper">
        <img 
          :src="planImageUrl" 
          class="plan-image"
          ref="planImage"
          @load="onImageLoad"
        />
        <div class="points-overlay" ref="pointsOverlay">
          <canvas ref="directionCanvas" class="direction-canvas"></canvas>
          <div
            v-for="group in groupedPoints"
            :key="group.key"
            class="point-marker"
            :style="getPointStyle(group)"
            @click="onPointClick(group)"
          >
            <div class="point-dot">
              <span v-if="group.count > 1" class="point-count">{{ group.count }}</span>
              <span v-else-if="group.points[0] && loadingPointId === group.points[0].id" class="point-loader">⟳</span>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="no-plan">
        <span>План не найден</span>
      </div>
    </div>

    <div class="plan-footer">
      <div class="resize-handle" @mousedown.stop="onResizeStart"></div>
    </div>

    <div v-if="showDateDialog" class="date-dialog-overlay" @click="closeDateDialog">
      <div class="date-dialog" @click.stop>
        <div class="date-dialog-header">
          <span>Выберите дату</span>
          <button class="date-dialog-close" @click="closeDateDialog">✕</button>
        </div>
        <div class="date-dialog-list">
          <div
            v-for="point in selectedGroupPoints"
            :key="point.id"
            class="date-dialog-item"
            @click="selectDatePoint(point)"
          >
            <span>{{ point.date || point.name || 'Без даты' }}</span>
            <span class="date-dialog-arrow">→</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Кнопка показа плана, когда он скрыт -->
  <button 
    v-if="!visible && !isClosed"
    class="show-plan-btn"
    @click="showPlan"
    title="Показать план"
  >
    🗖
  </button>
</template>

<script>
import { PanoramaService } from '../services/PanoramaService';

export default {
  name: 'PlanViewer',
  props: {
    folderId: {
      type: String,
      required: true
    },
    folderName: {
      type: String,
      default: 'План'
    },
    objectsRepository: {
      type: Object,
      required: true
    },
    initialVisible: {
      type: Boolean,
      default: true
    },
    currentAzimuth: {
      type: Number,
      default: 0
    },
    activePointId: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      visible: this.initialVisible,
      isClosed: false,
      service: null,
      loading: true,
      
      planImageUrl: null,
      planWidth: 0,
      planHeight: 0,
      
      points: [],
      groupedPoints: [],
      
      showDateDialog: false,
      selectedGroupPoints: [],
      selectedGroupKey: null,
      
      loadingPointId: null,
      
      position: {
        x: 100,
        y: 50
      },
      size: {
        width: 800,
        height: 600
      },
      isDraggingWindow: false,
      windowDragStartX: 0,
      windowDragStartY: 0,
      windowStartX: 0,
      windowStartY: 0,
      xpsWidth: null,
      xpsHeight: null,
      
      isResizing: false,
      resizeStartX: 0,
      resizeStartY: 0,
      resizeStartWidth: 0,
      resizeStartHeight: 0,
      
      canvasReady: false
    };
  },
  computed: {
    planTitle() {
      return this.folderName || 'План здания';
    }
  },
  watch: {
    currentAzimuth: {
      handler() {
        this.drawSector();
      },
      immediate: true
    },
    activePointId: {
      handler() {
        this.drawSector();
      },
      immediate: true
    },
    size: {
      handler() {
        this.$nextTick(() => {
          this.drawSector();
        });
      },
      deep: true
    }
  },
  async mounted() {
    this.service = new PanoramaService(this.objectsRepository);
    await this.loadPlan();
    
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
    window.addEventListener('resize', this.onWindowResize);
  },
  beforeDestroy() {
    if (this.planImageUrl && this.planImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.planImageUrl);
    }
    if (this.service) {
      this.service.clearUrls(this.points);
    }
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
    window.removeEventListener('resize', this.onWindowResize);
  },
  methods: {
    async loadPlan() {
      this.loading = true;
      try {
        // Получаем картинку и размеры XPS
        const result = await this.service.getPlanImageWithSize(this.folderId);
        
        if (!result || !result.imageUrl) {
          console.warn('План не найден');
          this.loading = false;
          return;
        }

        this.planImageUrl = result.imageUrl;
        this.xpsWidth = result.xpsWidth;
        this.xpsHeight = result.xpsHeight;
        
        
        const pointsData = await this.service.getPanorams(this.folderId);
        this.points = Object.values(pointsData);
        
        this.groupPoints();
        
        const img = new Image();
        img.onload = () => {
          this.planWidth = img.width;
          this.planHeight = img.height;
          this.loading = false;
          this.$nextTick(() => {
            this.canvasReady = true;
            this.drawSector();
          });
        };
        img.onerror = () => {
          console.error('Ошибка загрузки изображения');
          this.loading = false;
        };
        img.src = this.planImageUrl;
        
      } catch (error) {
        console.error('Ошибка загрузки плана:', error);
        this.loading = false;
      }
    },

    groupPoints() {
      const groups = new Map();
      
      for (const point of this.points) {
        const key = `${Math.round(point.x || 0)},${Math.round(point.y || 0)}`;
        if (groups.has(key)) {
          const group = groups.get(key);
          group.points.push(point);
          group.count++;
        } else {
          groups.set(key, {
            key: key,
            x: point.x || 0,
            y: point.y || 0,
            points: [point],
            count: 1
          });
        }
      }
      
      this.groupedPoints = Array.from(groups.values());
    },

    getPointStyle(group) {
      if (!this.planWidth || !this.planHeight) {
        return { display: 'none' };
      }
      
      const container = this.$refs.planContainer;
      if (!container) {
        return { display: 'none' };
      }
      
      const containerRect = container.getBoundingClientRect();
      
      const imgRatio = this.planWidth / this.planHeight;
      const containerRatio = containerRect.width / containerRect.height;
      
      let displayWidth, displayHeight, offsetX, offsetY;
      
      if (imgRatio > containerRatio) {
        displayWidth = containerRect.width;
        displayHeight = containerRect.width / imgRatio;
        offsetX = 0;
        offsetY = (containerRect.height - displayHeight) / 2;
      } else {
        displayHeight = containerRect.height;
        displayWidth = containerRect.height * imgRatio;
        offsetX = (containerRect.width - displayWidth) / 2;
        offsetY = 0;
      }
      
      // Масштабируем координаты из XPS в пиксели PNG
      let x = group.x;
      let y = group.y;
      
      if (this.xpsWidth && this.xpsHeight) {
        const scaleX = this.planWidth / this.xpsWidth;
        const scaleY = this.planHeight / this.xpsHeight;
        x = group.x * scaleX;
        y = group.y * scaleY;
      }
      
      const finalX = offsetX + (x / this.planWidth) * displayWidth;
      const finalY = offsetY + (y / this.planHeight) * displayHeight;
      
      return {
        left: finalX + 'px',
        top: finalY + 'px',
        position: 'absolute',
        transform: 'translate(-50%, -50%)'
      };
    },

    drawSector() {
      if (!this.canvasReady) return;
      
      const canvas = this.$refs.directionCanvas;
      if (!canvas) return;
      
      const container = this.$refs.planContainer;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      if (!this.activePointId) return;
      
      const activeGroup = this.groupedPoints.find(
        g => g.points[0] && g.points[0].id === this.activePointId
      );
      if (!activeGroup) return;
      
      const style = this.getPointStyle(activeGroup);
      
      const cx = parseFloat(style.left);
      const cy = parseFloat(style.top);
      
      const angle = (this.currentAzimuth - 90) * Math.PI / 180;
      const radius = 40;
      
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -Math.PI / 5, Math.PI / 5);
      ctx.closePath();
      
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0, 'rgba(66, 133, 244, 0.6)');
      grad.addColorStop(0.6, 'rgba(66, 133, 244, 0.35)');
      grad.addColorStop(1, 'rgba(66, 133, 244, 0.25)');
      ctx.fillStyle = grad;
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(66, 133, 244, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
    },

    onWindowResize() {
      this.$nextTick(() => {
        this.drawSector();
      });
    },

    async onPointClick(group) {
      if (group.count > 1) {
        this.selectedGroupPoints = group.points;
        this.selectedGroupKey = group.key;
        this.showDateDialog = true;
        return;
      }
      
      const point = group.points[0];
      await this.openPanorama(point);
    },

    async selectDatePoint(point) {
      this.showDateDialog = false;
      await this.openPanorama(point);
    },

    async openPanorama(point) {
      this.loadingPointId = point.id;
      
      try {
        const url = await this.service.loadPanoramaFile(point.id);
        
        if (url) {
          this.$emit('open-panorama', {
            id: point.id,
            url: url,
            title: point.name || 'Панорама 360°',
            azimuth: point.azimuth || 0
          });
        } else {
          alert('Не удалось загрузить панораму');
        }
      } catch (error) {
        console.error('Ошибка загрузки панорамы:', error);
        alert('Не удалось загрузить панораму');
      } finally {
        this.loadingPointId = null;
      }
    },

    closeDateDialog() {
      this.showDateDialog = false;
      this.selectedGroupPoints = [];
      this.selectedGroupKey = null;
    },

    onImageLoad() {
      const img = this.$refs.planImage;
      if (img) {
        this.planWidth = img.naturalWidth;
        this.planHeight = img.naturalHeight;
      }
    },

    onHeaderMouseDown(event) {
      if (event.target.closest('button')) return;
      this.isDraggingWindow = true;
      this.windowDragStartX = event.clientX;
      this.windowDragStartY = event.clientY;
      this.windowStartX = this.position.x;
      this.windowStartY = this.position.y;
    },

    onWindowMouseMove(event) {
      if (this.isDraggingWindow) {
        const dx = event.clientX - this.windowDragStartX;
        const dy = event.clientY - this.windowDragStartY;
        this.position.x = Math.max(0, this.windowStartX + dx);
        this.position.y = Math.max(0, this.windowStartY + dy);
      }
      
      if (this.isResizing) {
        const dx = event.clientX - this.resizeStartX;
        const dy = event.clientY - this.resizeStartY;
        this.size.width = Math.max(400, this.resizeStartWidth + dx);
        this.size.height = Math.max(300, this.resizeStartHeight + dy);
      }
    },

    onWindowMouseUp() {
      this.isDraggingWindow = false;
      this.isResizing = false;
    },

    onResizeStart(event) {
      this.isResizing = true;
      this.resizeStartX = event.clientX;
      this.resizeStartY = event.clientY;
      this.resizeStartWidth = this.size.width;
      this.resizeStartHeight = this.size.height;
    },

    hidePlan() {
      this.visible = false;
      this.isClosed = false;
    },

    showPlan() {
      this.visible = true;
      this.isClosed = false;
      this.$nextTick(() => {
        this.$forceUpdate();
        setTimeout(() => {
          this.drawSector();
        }, 100);
      });
    },

    close() {
      this.visible = false;
      this.isClosed = true;
      this.$emit('close');
    },

    show() {
      this.visible = true;
      this.isClosed = false;
    }
  }
};
</script>

<style scoped>
.plan-viewer {
  position: fixed;
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
  z-index: 10000;
  border-radius: 8px;
  border: 2px solid #76528a;
  box-shadow: 0 20px 60px rgba(255, 255, 255, 0.9);
  overflow: hidden;
  min-width: 400px;
  min-height: 300px;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  height: 40px;
  min-height: 40px;
  background: rgba(70, 36, 103, 0.95);
  border-bottom: 2px solid #76528a;
  flex-shrink: 0;
  cursor: move;
  user-select: none;
}

.plan-title {
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  flex: 1;
  text-align: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.hide-btn {
  background: none;
  border: none;
  color: #ffffff;
  font-size: 18px;
  cursor: pointer;
  padding: 2px 10px;
  border-radius: 4px;
  transition: all 0.2s;
  line-height: 1.5;
}

.hide-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.close-btn {
  background: none;
  border: none;
  color: #ffffff;
  font-size: 18px;
  cursor: pointer;
  padding: 2px 10px;
  border-radius: 4px;
  transition: all 0.2s;
  line-height: 1.5;
}

.close-btn:hover {
  background: rgba(255, 68, 68, 0.3);
}

.plan-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #dfdede;
}

.plan-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.plan-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.points-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.direction-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

.point-marker {
  pointer-events: all;
  cursor: pointer;
  width: 20px;
  height: 20px;
  position: absolute;
  z-index: 5;
}

.point-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ff4444;
  border: 2px solid #ffffff;
  box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  color: #ffffff;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
}

.point-marker:hover .point-dot {
  transform: scale(1.3);
  background: #ff6b6b;
  box-shadow: 0 0 20px rgba(255, 68, 68, 0.8);
  z-index: 10;
}

.point-count {
  font-size: 10px;
  font-weight: bold;
  color: #ffffff;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
}

.point-loader {
  font-size: 12px;
  animation: spin 1s linear infinite;
  color: #ffffff;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-overlay, .no-plan {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #dfdede;
  color: #ffffff;
  font-size: 18px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.7);
  border-top: 4px solid #76528a;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.plan-footer {
  height: 12px;
  min-height: 12px;
  background: rgba(70, 36, 103, 0.7);
  border-top: 1px solid #76528a;
  flex-shrink: 0;
  position: relative;
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, #76528a 50%);
}

.resize-handle:hover {
  background: linear-gradient(135deg, transparent 50%, #8a6a9e 50%);
}

.show-plan-btn {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(70, 36, 103, 0.9);
  border: 2px solid #76528a;
  color: #ffffff;
  font-size: 20px;
  cursor: pointer;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
}

.show-plan-btn:hover {
  transform: scale(1.1);
  background: rgba(70, 36, 103, 1);
  box-shadow: 0 4px 25px rgba(118, 82, 138, 0.5);
}

.date-dialog-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.date-dialog {
  background: #2a2a3e;
  border-radius: 8px;
  border: 1px solid #76528a;
  min-width: 250px;
  max-width: 400px;
  max-height: 300px;
  overflow: hidden;
}

.date-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(70, 36, 103, 0.9);
  border-bottom: 1px solid #76528a;
  color: #ffffff;
  font-size: 16px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
}

.date-dialog-close {
  background: none;
  border: none;
  color: #ffffff;
  font-size: 18px;
  cursor: pointer;
  padding: 0 8px;
}

.date-dialog-close:hover {
  color: #ff6b6b;
}

.date-dialog-list {
  padding: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.date-dialog-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: #ffffff;
  font-size: 14px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  transition: background 0.2s;
}

.date-dialog-item:hover {
  background: rgba(118, 82, 138, 0.4);
}

.date-dialog-arrow {
  color: #76528a;
}

.date-dialog-list::-webkit-scrollbar {
  width: 4px;
}

.date-dialog-list::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.date-dialog-list::-webkit-scrollbar-thumb {
  background: #76528a;
  border-radius: 2px;
}
</style>