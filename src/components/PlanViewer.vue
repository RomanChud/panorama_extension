<template>
  <div 
    v-if="visible"
    class="plan-viewer"
    :class="{ 'mobile': isMobile }"
    :style="{
      left: position.x + 'px',
      top: position.y + 'px',
      width: size.width + 'px',
      height: size.height + 'px'
    }"
  >
    <div class="plan-header" @mousedown="onHeaderMouseDown" @touchstart="onTouchStart">
      <span class="plan-title">{{ planTitle }}</span>
      <div class="header-actions">
        <div class="version-selectors" ref="versionSelectors">
          <!-- Сначала высота -->
          <div class="version-selector">
            <button 
              class="version-btn height-btn" 
              @click.stop="toggleHeightMenu"
              @touchstart.stop
              :disabled="availableHeights.length <= 1"
            >
              {{ selectedHeight || '—' }}
              <span v-if="availableHeights.length > 1" class="version-arrow">▼</span>
            </button>
            <div 
              v-if="showHeightMenu && availableHeights.length > 1" 
              class="version-dropdown" 
              @click.stop
              @mouseleave="closeHeightMenu"
            >
              <div
                v-for="height in availableHeights"
                :key="height"
                class="version-item"
                :class="{ active: height === selectedHeight }"
                @click="selectHeight(height)"
              >
                {{ height }}
              </div>
            </div>
          </div>
          
          <!-- Потом год -->
          <div class="version-selector">
            <button 
              class="version-btn year-btn" 
              @click.stop="toggleYearMenu"
              @touchstart.stop
              :disabled="availableYears.length <= 1"
            >
              {{ selectedYear || 'Нет данных' }}
              <span v-if="availableYears.length > 1" class="version-arrow">▼</span>
            </button>
            <div 
              v-if="showYearMenu && availableYears.length > 1" 
              class="version-dropdown" 
              @click.stop
              @mouseleave="closeYearMenu"
            >
              <div
                v-for="year in availableYears"
                :key="year"
                class="version-item"
                :class="{ active: year === selectedYear }"
                @click="selectYear(year)"
              >
                {{ year }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Кнопка замены плана -->
        <button 
          v-if="showReplaceButton" 
          class="replace-btn" 
          :class="{ 'replaced': isReplaced }"
          @click="replacePlan"
          :title="replaceButtonTitle"
        >
          {{ replaceButtonIcon }}
        </button>
        
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
      <div class="resize-handle" 
           @mousedown.stop="onResizeStart" 
           @touchstart.stop="onResizeTouchStart">
      </div>
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

  <button 
    v-if="!visible && !isClosed"
    class="show-plan-btn"
    :class="{ 'mobile': isMobile }"
    @click="showPlan"
    title="Показать план"
  >
    🗖
  </button>
</template>

<script>
import { PanoramaService } from '../services/PanoramaService';
import JSZip from 'jszip';

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
    },
    isMobile: {
      type: Boolean,
      default: false
    },
    allVersions: {
      type: Array,
      default: () => []
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
      
      isResizing: false,
      resizeStartX: 0,
      resizeStartY: 0,
      resizeStartWidth: 0,
      resizeStartHeight: 0,
      
      isResizingTouch: false,
      resizeTouchStartX: 0,
      resizeTouchStartY: 0,
      resizeTouchStartWidth: 0,
      resizeTouchStartHeight: 0,
      
      canvasReady: false,
      xpsWidth: null,
      xpsHeight: null,
      
      versions: [],
      allPlans: [],
      currentPlanId: this.folderId,
      
      selectedYear: null,
      selectedHeight: null,
      showYearMenu: false,
      showHeightMenu: false,
      
      isReplacing: false,
      isReplaced: false,
      originalPlanData: null,
      
      displayName: this.folderName,
    };
  },
  computed: {
    planTitle() {
      return this.displayName || this.folderName || 'План здания';
    },
    availableHeights() {
      const heights = new Set();
      for (const v of this.versions) {
        const height = v.height || '—';
        heights.add(height);
      }
      return Array.from(heights).sort((a, b) => {
        if (a === '—') return 1;
        if (b === '—') return -1;
        const aNum = parseFloat(a);
        const bNum = parseFloat(b);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.localeCompare(b);
      });
    },
    availableYears() {
      if (!this.selectedHeight) return [];
      const years = new Set();
      for (const v of this.versions) {
        if ((v.height || '—') === this.selectedHeight && v.year && v.year !== 'Нет данных') {
          years.add(v.year);
        }
      }
      return Array.from(years).sort((a, b) => a - b);
    },
    showReplaceButton() {
      const replaceablePlans = [
        '5c953dad-db4b-4dc8-aa12-70a63e1471c2',
      ];
      return replaceablePlans.includes(this.folderId);
    },
    replaceButtonTitle() {
      return this.isReplaced ? 'Вернуть оригинальный план' : 'Заменить план';
    },
    replaceButtonIcon() {
      return this.isReplaced ? '↺' : '↻';
    }
  },
  watch: {
    currentAzimuth: {
      handler() { this.drawSector(); },
      immediate: true
    },
    activePointId: {
      handler() { this.drawSector(); },
      immediate: true
    },
    size: {
      handler() {
        this.$nextTick(() => { this.drawSector(); });
      },
      deep: true
    }
  },
  async mounted() {
    if (this.isMobile) {
      this.size.width = Math.min(window.innerWidth - 20, 500);
      this.size.height = Math.min(window.innerHeight - 100, 500);
      this.position.x = 10;
      this.position.y = 20;
    }
    
    this.service = new PanoramaService(this.objectsRepository);
    await this.loadPlan();
    
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
    window.addEventListener('resize', this.onWindowResize);
    
    if (this.isMobile) {
      window.addEventListener('touchmove', this.onTouchMove);
      window.addEventListener('touchend', this.onTouchEnd);
    }
    
    document.addEventListener('click', this.closeMenusOnClickOutside);
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
    if (this.isMobile) {
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('touchend', this.onTouchEnd);
    }
    document.removeEventListener('click', this.closeMenusOnClickOutside);
  },
  methods: {
    closeMenusOnClickOutside(event) {
      const selector = this.$refs.versionSelectors;
      if (selector && !selector.contains(event.target)) {
        this.showHeightMenu = false;
        this.showYearMenu = false;
      }
    },

    closeHeightMenu() {
      this.showHeightMenu = false;
    },
    closeYearMenu() {
      this.showYearMenu = false;
    },

    async replacePlan() {
      if (this.isReplacing) return;
      
      const replacements = {
        '5c953dad-db4b-4dc8-aa12-70a63e1471c2': 'ea9af3da-d8be-46e3-a456-e01a21850d54',
      };
      
      const targetId = replacements[this.folderId];
      if (!targetId) return;
      
      const targetVersion = this.allPlans.find(p => p.id === targetId);
      if (!targetVersion) return;
      
      this.isReplacing = true;
      this.loading = true;
      
      try {
        // Если уже заменено - возвращаем оригинал
        if (this.isReplaced && this.originalPlanData) {
          console.log('🔄 Возврат к оригинальному плану');
          
          this.planImageUrl = this.originalPlanData.planImageUrl;
          this.xpsWidth = this.originalPlanData.xpsWidth;
          this.xpsHeight = this.originalPlanData.xpsHeight;
          this.planWidth = this.originalPlanData.planWidth;
          this.planHeight = this.originalPlanData.planHeight;
          this.points = this.originalPlanData.points.map(p => ({ ...p }));
          this.groupPoints();
          this.currentPlanId = this.originalPlanData.folderId;
          this.displayName = this.originalPlanData.folderName;
          this.isReplaced = false;
          this.originalPlanData = null;
          
          this.loading = false;
          this.isReplacing = false;
          this.$nextTick(() => {
            this.canvasReady = true;
            this.drawSector();
          });
          return;
        }
        
        // Сохраняем оригинальные данные в кэш
        if (!this.originalPlanData) {
          this.originalPlanData = {
            planImageUrl: this.planImageUrl,
            xpsWidth: this.xpsWidth,
            xpsHeight: this.xpsHeight,
            planWidth: this.planWidth,
            planHeight: this.planHeight,
            points: this.points.map(p => ({ ...p })),
            folderId: this.folderId,
            folderName: this.displayName || this.folderName,
          };
        }
        
        const currentPoints = this.points.map(p => ({ ...p }));
        
        const currentSize = await this.getPlanDimensions(this.folderId);
        const targetSize = await this.getPlanDimensions(targetId);
        
        if (currentSize && targetSize) {
          const scaleX = targetSize.width / currentSize.width;
          const scaleY = targetSize.height / currentSize.height;
          
          console.log(`🔄 Замена плана: ${this.folderId} -> ${targetId}`);
          console.log(`📐 Коэффициенты: X=${scaleX}, Y=${scaleY}`);
          
          this.points = currentPoints.map(point => ({
            ...point,
            x: point.x !== null && point.x !== undefined ? point.x * scaleX : null,
            y: point.y !== null && point.y !== undefined ? point.y * scaleY : null,
          }));
          
          this.groupPoints();
        } else {
          console.warn('Не удалось получить размеры планов, точки не пересчитаны');
        }
        
        const result = await this.service.getPlanImageWithSize(targetId);
        
        if (!result || !result.imageUrl) {
          this.loading = false;
          this.isReplacing = false;
          return;
        }

        this.planImageUrl = result.imageUrl;
        this.xpsWidth = result.xpsWidth;
        this.xpsHeight = result.xpsHeight;
        
        if (targetVersion.title) {
          this.displayName = targetVersion.title;
        }
        
        this.currentPlanId = targetId;
        this.isReplaced = true;
        
        const img = new Image();
        img.onload = () => {
          this.planWidth = img.width;
          this.planHeight = img.height;
          this.loading = false;
          this.isReplacing = false;
          this.$nextTick(() => {
            this.canvasReady = true;
            this.drawSector();
          });
        };
        img.onerror = () => {
          this.loading = false;
          this.isReplacing = false;
        };
        img.src = this.planImageUrl;
        
      } catch (error) {
        console.error('Ошибка замены плана:', error);
        this.loading = false;
        this.isReplacing = false;
      }
    },
    
    async getPlanDimensions(planId) {
      try {
        const folderData = await this.service.getObject(planId);
        if (!folderData) return null;
        
        const files = folderData.actualFileSnapshot?.files || [];
        const planFile = files.find(f => f.name?.match(/\.(xps|pdf)$/i));
        if (!planFile) return null;
        
        if (planFile.name?.match(/\.xps$/i)) {
          const formData = new URLSearchParams();
          formData.append('ids', planId);
          formData.append('signatures', '1');
          formData.append('printPreview', '1');
          formData.append('annotationsFilter', '');
          formData.append('coincidenceOfNames', '1');
          
          const response = await fetch('/api/Files/GetFileArchive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
            credentials: 'include'
          });
          
          const buffer = await response.arrayBuffer();
          const zip = await JSZip.loadAsync(buffer);
          const xpsFile = Object.keys(zip.files).find(name => name.match(/\.xps$/i));
          
          if (xpsFile) {
            const xpsBuffer = await zip.files[xpsFile].async('arraybuffer');
            const xpsZip = await JSZip.loadAsync(xpsBuffer);
            const fpageFile = Object.keys(xpsZip.files).find(name => name.match(/\.fpage$/i));
            
            if (fpageFile) {
              const fpageContent = await xpsZip.files[fpageFile].async('string');
              const widthMatch = fpageContent.match(/Width="([^"]+)"/);
              const heightMatch = fpageContent.match(/Height="([^"]+)"/);
              if (widthMatch && heightMatch) {
                return {
                  width: parseFloat(widthMatch[1]),
                  height: parseFloat(heightMatch[1])
                };
              }
            }
          }
        }
        
        const imageUrl = await this.service.getPlanImage(planId);
        if (imageUrl) {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              resolve({
                width: img.width,
                height: img.height
              });
            };
            img.onerror = () => {
              resolve(null);
            };
            img.src = imageUrl;
          });
        }
        
        return null;
      } catch (error) {
        console.error('Ошибка получения размеров плана:', error);
        return null;
      }
    },

    async loadPlan() {
      this.loading = true;
      this.showYearMenu = false;
      this.showHeightMenu = false;
      this.isReplaced = false;
      this.originalPlanData = null;
      this.displayName = this.folderName;
      
      try {
        let versionsWithYear = [];
        
        if (this.allVersions && this.allVersions.length > 0) {
          versionsWithYear = this.allVersions.map(v => ({
            ...v,
            year: v.year || 'Нет данных'
          }));
          this.allPlans = this.allVersions;
        } else {
          const grouped = await this.service.getGroupedPlans(this.folderId);
          let currentGroup = null;
          for (const [key, group] of Object.entries(grouped)) {
            if (group.plans.some(p => p.id === this.folderId)) {
              currentGroup = group;
              break;
            }
          }
          
          if (currentGroup) {
            versionsWithYear = currentGroup.versions;
            this.allPlans = currentGroup.plans;
          } else {
            versionsWithYear = [{
              id: this.folderId,
              label: this.folderName || 'План',
              height: '—',
              year: 'Нет данных',
              title: this.folderName
            }];
            this.allPlans = [{
              id: this.folderId,
              title: this.folderName,
              year: null,
              height: null,
              _raw: null
            }];
          }
        }
        
        this.versions = versionsWithYear.map(v => ({
          id: v.id,
          label: v.name || v.label || 'Версия',
          height: v.height || '—',
          year: v.year || 'Нет данных',
          title: v.name || v.title
        }));
        
        const current = versionsWithYear.find(v => v.id === this.folderId);
        if (current) {
          this.currentPlanId = this.folderId;
        } else if (versionsWithYear.length > 0) {
          const first = versionsWithYear[0];
          this.currentPlanId = first.id;
          if (first.id !== this.folderId) {
            this.$emit('switch-plan', first.id);
          }
        }
        
        if (this.versions.length > 0 && (this.selectedYear === null || this.selectedHeight === null)) {
          const currentVersion = this.versions.find(v => v.id === this.currentPlanId);
          if (currentVersion) {
            this.selectedHeight = currentVersion.height || '—';
            this.selectedYear = currentVersion.year !== 'Нет данных' ? currentVersion.year : this.availableYears[0] || null;
          } else {
            const heights = this.availableHeights;
            if (heights.length > 0) {
              this.selectedHeight = heights[0];
              const years = this.availableYears;
              this.selectedYear = years.length > 0 ? years[0] : null;
            } else {
              const first = this.versions[0];
              this.selectedHeight = first.height || '—';
              this.selectedYear = null;
            }
          }
        }
        
        const result = await this.service.getPlanImageWithSize(this.folderId);
        
        if (!result || !result.imageUrl) {
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
      if (!this.planWidth || !this.planHeight) return { display: 'none' };
      const container = this.$refs.planContainer;
      if (!container) return { display: 'none' };
      
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
      this.$nextTick(() => { this.drawSector(); });
    },

    onTouchStart(event) {
      if (event.target.closest('button')) return;
      const touch = event.touches[0];
      this.isDraggingWindow = true;
      this.windowDragStartX = touch.clientX;
      this.windowDragStartY = touch.clientY;
      this.windowStartX = this.position.x;
      this.windowStartY = this.position.y;
    },

    onTouchMove(event) {
      if (this.isDraggingWindow && this.isMobile) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.windowDragStartX;
        const dy = touch.clientY - this.windowDragStartY;
        this.position.x = Math.max(0, this.windowStartX + dx);
        this.position.y = Math.max(0, this.windowStartY + dy);
      }
      if (this.isResizingTouch && this.isMobile) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.resizeTouchStartX;
        const dy = touch.clientY - this.resizeTouchStartY;
        const minWidth = 200;
        const minHeight = 150;
        const maxWidth = window.innerWidth - 20;
        const maxHeight = window.innerHeight - 50;
        this.size.width = Math.min(maxWidth, Math.max(minWidth, this.resizeTouchStartWidth + dx));
        this.size.height = Math.min(maxHeight, Math.max(minHeight, this.resizeTouchStartHeight + dy));
      }
    },

    onTouchEnd() {
      this.isDraggingWindow = false;
      this.isResizingTouch = false;
    },

    onResizeTouchStart(event) {
      event.stopPropagation();
      const touch = event.touches[0];
      this.isResizingTouch = true;
      this.resizeTouchStartX = touch.clientX;
      this.resizeTouchStartY = touch.clientY;
      this.resizeTouchStartWidth = this.size.width;
      this.resizeTouchStartHeight = this.size.height;
    },

    onHeaderMouseDown(event) {
      if (event.target.closest('button')) return;
      if (this.isMobile) return;
      this.isDraggingWindow = true;
      this.windowDragStartX = event.clientX;
      this.windowDragStartY = event.clientY;
      this.windowStartX = this.position.x;
      this.windowStartY = this.position.y;
    },

    onWindowMouseMove(event) {
      if (this.isDraggingWindow && !this.isMobile) {
        const dx = event.clientX - this.windowDragStartX;
        const dy = event.clientY - this.windowDragStartY;
        this.position.x = Math.max(0, this.windowStartX + dx);
        this.position.y = Math.max(0, this.windowStartY + dy);
      }
      if (this.isResizing && !this.isMobile) {
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
      if (this.isMobile) return;
      this.isResizing = true;
      this.resizeStartX = event.clientX;
      this.resizeStartY = event.clientY;
      this.resizeStartWidth = this.size.width;
      this.resizeStartHeight = this.size.height;
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
          let height = null;
          const currentPlan = this.allPlans.find(p => p.id === this.currentPlanId);
          if (currentPlan && currentPlan.height) {
            height = currentPlan.height;
          }
          if (!height && point.height) {
            height = point.height;
          }
          
          let date = null;
          const file = point._raw?.actualFileSnapshot?.files?.[0];
          if (file?.body?.created) {
            date = file.body.created;
          } else if (point._raw?.created) {
            date = point._raw.created;
          }
          
          this.$emit('open-panorama', {
            id: point.id,
            url: url,
            title: point.name || 'Панорама 360°',
            azimuth: point.azimuth || 0,
            height: height,
            date: date,
            year: currentPlan?.year || point.year || null
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

    // async openPanorama(point) {
    //   this.loadingPointId = point.id;
    //   try {
    //     const url = await this.service.loadPanoramaFile(point.id);
    //     if (url) {
    //       let height = null;
    //       const currentPlan = this.allPlans.find(p => p.id === this.currentPlanId);
    //       if (currentPlan && currentPlan.height) {
    //         height = currentPlan.height;
    //       }
    //       if (!height && point.height) {
    //         height = point.height;
    //       }
          
    //       let date = null;
    //       const file = point._raw?.actualFileSnapshot?.files?.[0];
    //       if (file?.body?.created) {
    //         date = file.body.created;
    //       } else if (point._raw?.created) {
    //         date = point._raw.created;
    //       }
          
    //       this.$emit('open-panorama', {
    //         id: point.id,
    //         url: url,
    //         title: point.name || 'Панорама 360°',
    //         azimuth: point.azimuth || 0,
    //         height: height,
    //         date: date,
    //         year: currentPlan?.year || point.year || null
    //       });
    //     } else {
    //       alert('Не удалось загрузить панораму');
    //     }
    //   } catch (error) {
    //     console.error('Ошибка загрузки панорамы:', error);
    //     alert('Не удалось загрузить панораму');
    //   } finally {
    //     this.loadingPointId = null;
    //   }
    // },

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

    toggleHeightMenu() {
      if (this.availableHeights.length > 1) {
        this.showHeightMenu = !this.showHeightMenu;
        this.showYearMenu = false;
      }
    },

    toggleYearMenu() {
      if (this.availableYears.length > 1) {
        this.showYearMenu = !this.showYearMenu;
        this.showHeightMenu = false;
      }
    },

    selectHeight(height) {
      this.selectedHeight = height;
      this.showHeightMenu = false;
      
      const years = this.availableYears;
      let targetYear = this.selectedYear;
      if (!years.includes(targetYear)) {
        targetYear = years.length > 0 ? years[0] : null;
      }
      this.selectedYear = targetYear;
      
      const version = this.versions.find(v => 
        (v.height || '—') === height && v.year === targetYear
      );
      
      if (version && version.id !== this.currentPlanId) {
        this.switchToVersion(version.id);
      }
    },

    selectYear(year) {
      this.selectedYear = year;
      this.showYearMenu = false;
      
      const version = this.versions.find(v => 
        (v.height || '—') === this.selectedHeight && v.year === year
      );
      
      if (version && version.id !== this.currentPlanId) {
        this.switchToVersion(version.id);
      }
    },

    async switchToVersion(planId) {
      const savedHeight = this.selectedHeight;
      const savedYear = this.selectedYear;
      
      this.currentPlanId = planId;
      this.loading = true;
      this.$emit('switch-plan', planId);
      
      try {
        const result = await this.service.getPlanImageWithSize(planId);
        
        if (!result || !result.imageUrl) {
          this.loading = false;
          return;
        }

        this.planImageUrl = result.imageUrl;
        this.xpsWidth = result.xpsWidth;
        this.xpsHeight = result.xpsHeight;
        
        const pointsData = await this.service.getPanorams(planId);
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
          this.loading = false;
        };
        img.src = this.planImageUrl;
        
        this.selectedHeight = savedHeight;
        this.selectedYear = savedYear;
        this.isReplaced = false;
        this.originalPlanData = null;
        this.displayName = this.folderName;
        
      } catch (error) {
        console.error('Ошибка загрузки плана:', error);
        this.loading = false;
      }
    },

    async selectVersion(planId) {
      await this.switchToVersion(planId);
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
        setTimeout(() => { this.drawSector(); }, 100);
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
  font-size: 16px;
  font-weight: 700;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  flex: 1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.version-selectors {
  display: flex;
  align-items: center;
  gap: 4px;
}

.version-selector {
  position: relative;
  display: inline-block;
}

.version-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 11px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 40px;
}

.version-btn.height-btn {
  min-width: 40px;
  background: rgba(255, 193, 7, 0.15);
  border-color: rgba(255, 193, 7, 0.25);
}

.version-btn.year-btn {
  min-width: 50px;
  background: rgba(66, 133, 244, 0.2);
  border-color: rgba(66, 133, 244, 0.3);
}

.version-btn.height-btn:hover:not(:disabled) {
  background: rgba(255, 193, 7, 0.25);
}

.version-btn.year-btn:hover:not(:disabled) {
  background: rgba(66, 133, 244, 0.3);
}

.version-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.version-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.version-arrow {
  font-size: 8px;
  margin-left: 2px;
}

.version-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #1a1a2e;
  border: 1px solid #76528a;
  border-radius: 6px;
  min-width: 80px;
  max-height: 150px;
  overflow-y: auto;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.version-item {
  padding: 4px 10px;
  color: #ffffff;
  font-size: 11px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.version-item:hover {
  background: rgba(118, 82, 138, 0.3);
}

.version-item.active {
  background: rgba(118, 82, 138, 0.5);
  color: #ffffff;
}

.version-dropdown::-webkit-scrollbar {
  width: 4px;
}

.version-dropdown::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.version-dropdown::-webkit-scrollbar-thumb {
  background: #76528a;
  border-radius: 2px;
}

.replace-btn {
  background: rgba(76, 175, 80, 0.25);
  border: 1px solid rgba(76, 175, 80, 0.3);
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  padding: 1px 6px;
  border-radius: 4px;
  transition: all 0.2s;
  line-height: 1.4;
  font-weight: 700;
}

.replace-btn:hover {
  background: rgba(76, 175, 80, 0.5);
  transform: scale(1.1);
}

.replace-btn.replaced {
  background: rgba(255, 152, 0, 0.25);
  border-color: rgba(255, 152, 0, 0.3);
}

.replace-btn.replaced:hover {
  background: rgba(255, 152, 0, 0.5);
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

@media (max-width: 768px) {
  .plan-viewer.mobile {
    border-radius: 8px !important;
    border: 2px solid #76528a !important;
    min-width: 200px !important;
    min-height: 150px !important;
    max-width: 95vw !important;
    max-height: 80vh !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9) !important;
    backdrop-filter: blur(10px);
    background: #1a1a2e;
  }

  .plan-viewer.mobile .plan-header {
    cursor: move;
    height: 35px;
    min-height: 35px;
    background: rgba(70, 36, 103, 0.95);
  }

  .plan-viewer.mobile .plan-title {
    font-size: 13px;
  }

  .plan-viewer.mobile .plan-footer {
    display: block !important;
    height: 16px;
    min-height: 16px;
  }

  .plan-viewer.mobile .resize-handle {
    display: block !important;
  }

  .plan-viewer.mobile .point-dot {
    width: 20px;
    height: 20px;
    font-size: 10px;
  }

  .plan-viewer.mobile .version-btn {
    font-size: 9px;
    padding: 1px 5px;
    min-width: 30px;
  }

  .plan-viewer.mobile .version-dropdown {
    min-width: 60px;
    max-height: 120px;
  }

  .plan-viewer.mobile .version-item {
    font-size: 9px;
    padding: 3px 8px;
  }

  .plan-viewer.mobile .version-selectors {
    gap: 2px;
  }

  .plan-viewer.mobile .replace-btn {
    font-size: 12px;
    padding: 1px 4px;
  }

  .show-plan-btn.mobile {
    width: 40px;
    height: 40px;
    font-size: 18px;
    bottom: 15px;
    left: 15px;
  }
}

@media (max-width: 480px) {
  .plan-viewer:not(.mobile) {
    min-width: 280px;
    min-height: 180px;
  }
}
</style>


<!-- <template>
  <div 
    v-if="visible"
    class="plan-viewer"
    :class="{ 'mobile': isMobile }"
    :style="{
      left: position.x + 'px',
      top: position.y + 'px',
      width: size.width + 'px',
      height: size.height + 'px'
    }"
  >
    <div class="plan-header" @mousedown="onHeaderMouseDown" @touchstart="onTouchStart">
      <span class="plan-title">{{ planTitle }}</span>
      <div class="header-actions">
        <div class="version-selectors" ref="versionSelectors">
          <div class="version-selector">
            <button 
              class="version-btn height-btn" 
              @click.stop="toggleHeightMenu"
              @touchstart.stop
              :disabled="availableHeights.length <= 1"
            >
              {{ selectedHeight || '—' }}
              <span v-if="availableHeights.length > 1" class="version-arrow">▼</span>
            </button>
            <div 
              v-if="showHeightMenu && availableHeights.length > 1" 
              class="version-dropdown" 
              @click.stop
              @mouseleave="closeHeightMenu"
            >
              <div
                v-for="height in availableHeights"
                :key="height"
                class="version-item"
                :class="{ active: height === selectedHeight }"
                @click="selectHeight(height)"
              >
                {{ height }}
              </div>
            </div>
          </div>
          
          <div class="version-selector">
            <button 
              class="version-btn year-btn" 
              @click.stop="toggleYearMenu"
              @touchstart.stop
              :disabled="availableYears.length <= 1"
            >
              {{ selectedYear || 'Нет данных' }}
              <span v-if="availableYears.length > 1" class="version-arrow">▼</span>
            </button>
            <div 
              v-if="showYearMenu && availableYears.length > 1" 
              class="version-dropdown" 
              @click.stop
              @mouseleave="closeYearMenu"
            >
              <div
                v-for="year in availableYears"
                :key="year"
                class="version-item"
                :class="{ active: year === selectedYear }"
                @click="selectYear(year)"
              >
                {{ year }}
              </div>
            </div>
          </div>
        </div>
        
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
      <div class="resize-handle" 
           @mousedown.stop="onResizeStart" 
           @touchstart.stop="onResizeTouchStart">
      </div>
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

  <button 
    v-if="!visible && !isClosed"
    class="show-plan-btn"
    :class="{ 'mobile': isMobile }"
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
    },
    isMobile: {
      type: Boolean,
      default: false
    },
    allVersions: {
      type: Array,
      default: () => []
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
      
      isResizing: false,
      resizeStartX: 0,
      resizeStartY: 0,
      resizeStartWidth: 0,
      resizeStartHeight: 0,
      
      isResizingTouch: false,
      resizeTouchStartX: 0,
      resizeTouchStartY: 0,
      resizeTouchStartWidth: 0,
      resizeTouchStartHeight: 0,
      
      canvasReady: false,
      xpsWidth: null,
      xpsHeight: null,
      
      versions: [],
      allPlans: [],
      currentPlanId: this.folderId,
      
      selectedYear: null,
      selectedHeight: null,
      showYearMenu: false,
      showHeightMenu: false,
    };
  },
  computed: {
    planTitle() {
      return this.folderName || 'План здания';
    },
    availableHeights() {
      const heights = new Set();
      for (const v of this.versions) {
        const height = v.height || '—';
        heights.add(height);
      }
      return Array.from(heights).sort((a, b) => {
        if (a === '—') return 1;
        if (b === '—') return -1;
        const aNum = parseFloat(a);
        const bNum = parseFloat(b);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.localeCompare(b);
      });
    },
    availableYears() {
      if (!this.selectedHeight) return [];
      const years = new Set();
      for (const v of this.versions) {
        if ((v.height || '—') === this.selectedHeight && v.year && v.year !== 'Нет данных') {
          years.add(v.year);
        }
      }
      return Array.from(years).sort((a, b) => a - b);
    }
  },
  watch: {
    currentAzimuth: {
      handler() { this.drawSector(); },
      immediate: true
    },
    activePointId: {
      handler() { this.drawSector(); },
      immediate: true
    },
    size: {
      handler() {
        this.$nextTick(() => { this.drawSector(); });
      },
      deep: true
    }
  },
  async mounted() {
    if (this.isMobile) {
      this.size.width = Math.min(window.innerWidth - 20, 500);
      this.size.height = Math.min(window.innerHeight - 100, 500);
      this.position.x = 10;
      this.position.y = 20;
    }
    
    this.service = new PanoramaService(this.objectsRepository);
    await this.loadPlan();
    
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
    window.addEventListener('resize', this.onWindowResize);
    
    if (this.isMobile) {
      window.addEventListener('touchmove', this.onTouchMove);
      window.addEventListener('touchend', this.onTouchEnd);
    }
    
    document.addEventListener('click', this.closeMenusOnClickOutside);
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
    if (this.isMobile) {
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('touchend', this.onTouchEnd);
    }
    document.removeEventListener('click', this.closeMenusOnClickOutside);
  },
  methods: {
    closeMenusOnClickOutside(event) {
      const selector = this.$refs.versionSelectors;
      if (selector && !selector.contains(event.target)) {
        this.showHeightMenu = false;
        this.showYearMenu = false;
      }
    },

    closeHeightMenu() {
      this.showHeightMenu = false;
    },
    closeYearMenu() {
      this.showYearMenu = false;
    },

    async loadPlan() {
      this.loading = true;
      this.showYearMenu = false;
      this.showHeightMenu = false;
      
      try {
        let versionsWithYear = [];
        
        if (this.allVersions && this.allVersions.length > 0) {
          versionsWithYear = this.allVersions.map(v => ({
            ...v,
            year: v.year || 'Нет данных'
          }));
          this.allPlans = this.allVersions;
        } else {
          const grouped = await this.service.getGroupedPlans(this.folderId);
          let currentGroup = null;
          for (const [key, group] of Object.entries(grouped)) {
            if (group.plans.some(p => p.id === this.folderId)) {
              currentGroup = group;
              break;
            }
          }
          
          if (currentGroup) {
            versionsWithYear = currentGroup.versions;
            this.allPlans = currentGroup.plans;
          } else {
            versionsWithYear = [{
              id: this.folderId,
              label: this.folderName || 'План',
              height: '—',
              year: 'Нет данных',
              title: this.folderName
            }];
            this.allPlans = [{
              id: this.folderId,
              title: this.folderName,
              year: null,
              height: null,
              _raw: null
            }];
          }
        }
        
        this.versions = versionsWithYear.map(v => ({
          id: v.id,
          label: v.name || v.label || 'Версия',
          height: v.height || '—',
          year: v.year || 'Нет данных',
          title: v.name || v.title
        }));
        
        const current = versionsWithYear.find(v => v.id === this.folderId);
        if (current) {
          this.currentPlanId = this.folderId;
        } else if (versionsWithYear.length > 0) {
          const first = versionsWithYear[0];
          this.currentPlanId = first.id;
          if (first.id !== this.folderId) {
            this.$emit('switch-plan', first.id);
          }
        }
        
        if (this.versions.length > 0 && (this.selectedYear === null || this.selectedHeight === null)) {
          const currentVersion = this.versions.find(v => v.id === this.currentPlanId);
          if (currentVersion) {
            this.selectedHeight = currentVersion.height || '—';
            this.selectedYear = currentVersion.year !== 'Нет данных' ? currentVersion.year : this.availableYears[0] || null;
          } else {
            const heights = this.availableHeights;
            if (heights.length > 0) {
              this.selectedHeight = heights[0];
              const years = this.availableYears;
              this.selectedYear = years.length > 0 ? years[0] : null;
            } else {
              const first = this.versions[0];
              this.selectedHeight = first.height || '—';
              this.selectedYear = null;
            }
          }
        }
        
        const result = await this.service.getPlanImageWithSize(this.folderId);
        
        if (!result || !result.imageUrl) {
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
      if (!this.planWidth || !this.planHeight) return { display: 'none' };
      const container = this.$refs.planContainer;
      if (!container) return { display: 'none' };
      
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
      this.$nextTick(() => { this.drawSector(); });
    },

    onTouchStart(event) {
      if (event.target.closest('button')) return;
      const touch = event.touches[0];
      this.isDraggingWindow = true;
      this.windowDragStartX = touch.clientX;
      this.windowDragStartY = touch.clientY;
      this.windowStartX = this.position.x;
      this.windowStartY = this.position.y;
    },

    onTouchMove(event) {
      if (this.isDraggingWindow && this.isMobile) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.windowDragStartX;
        const dy = touch.clientY - this.windowDragStartY;
        this.position.x = Math.max(0, this.windowStartX + dx);
        this.position.y = Math.max(0, this.windowStartY + dy);
      }
      if (this.isResizingTouch && this.isMobile) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.resizeTouchStartX;
        const dy = touch.clientY - this.resizeTouchStartY;
        const minWidth = 200;
        const minHeight = 150;
        const maxWidth = window.innerWidth - 20;
        const maxHeight = window.innerHeight - 50;
        this.size.width = Math.min(maxWidth, Math.max(minWidth, this.resizeTouchStartWidth + dx));
        this.size.height = Math.min(maxHeight, Math.max(minHeight, this.resizeTouchStartHeight + dy));
      }
    },

    onTouchEnd() {
      this.isDraggingWindow = false;
      this.isResizingTouch = false;
    },

    onResizeTouchStart(event) {
      event.stopPropagation();
      const touch = event.touches[0];
      this.isResizingTouch = true;
      this.resizeTouchStartX = touch.clientX;
      this.resizeTouchStartY = touch.clientY;
      this.resizeTouchStartWidth = this.size.width;
      this.resizeTouchStartHeight = this.size.height;
    },

    onHeaderMouseDown(event) {
      if (event.target.closest('button')) return;
      if (this.isMobile) return;
      this.isDraggingWindow = true;
      this.windowDragStartX = event.clientX;
      this.windowDragStartY = event.clientY;
      this.windowStartX = this.position.x;
      this.windowStartY = this.position.y;
    },

    onWindowMouseMove(event) {
      if (this.isDraggingWindow && !this.isMobile) {
        const dx = event.clientX - this.windowDragStartX;
        const dy = event.clientY - this.windowDragStartY;
        this.position.x = Math.max(0, this.windowStartX + dx);
        this.position.y = Math.max(0, this.windowStartY + dy);
      }
      if (this.isResizing && !this.isMobile) {
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
      if (this.isMobile) return;
      this.isResizing = true;
      this.resizeStartX = event.clientX;
      this.resizeStartY = event.clientY;
      this.resizeStartWidth = this.size.width;
      this.resizeStartHeight = this.size.height;
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
          let height = null;
          const currentPlan = this.allPlans.find(p => p.id === this.currentPlanId);
          if (currentPlan && currentPlan.height) {
            height = currentPlan.height;
          }
          if (!height && point.height) {
            height = point.height;
          }
          
          let date = null;
          const file = point._raw?.actualFileSnapshot?.files?.[0];
          if (file?.body?.created) {
            date = file.body.created;
          } else if (point._raw?.created) {
            date = point._raw.created;
          }
          
          this.$emit('open-panorama', {
            id: point.id,
            url: url,
            title: point.name || 'Панорама 360°',
            azimuth: point.azimuth || 0,
            height: height,
            date: date,
            year: currentPlan?.year || point.year || null
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

    toggleHeightMenu() {
      if (this.availableHeights.length > 1) {
        this.showHeightMenu = !this.showHeightMenu;
        this.showYearMenu = false;
      }
    },

    toggleYearMenu() {
      if (this.availableYears.length > 1) {
        this.showYearMenu = !this.showYearMenu;
        this.showHeightMenu = false;
      }
    },

    selectHeight(height) {
      this.selectedHeight = height;
      this.showHeightMenu = false;
      
      const years = this.availableYears;
      let targetYear = this.selectedYear;
      if (!years.includes(targetYear)) {
        targetYear = years.length > 0 ? years[0] : null;
      }
      this.selectedYear = targetYear;
      
      const version = this.versions.find(v => 
        (v.height || '—') === height && v.year === targetYear
      );
      
      if (version && version.id !== this.currentPlanId) {
        this.switchToVersion(version.id);
      }
    },

    selectYear(year) {
      this.selectedYear = year;
      this.showYearMenu = false;
      
      const version = this.versions.find(v => 
        (v.height || '—') === this.selectedHeight && v.year === year
      );
      
      if (version && version.id !== this.currentPlanId) {
        this.switchToVersion(version.id);
      }
    },

    async switchToVersion(planId) {
      const savedHeight = this.selectedHeight;
      const savedYear = this.selectedYear;
      
      this.currentPlanId = planId;
      this.loading = true;
      this.$emit('switch-plan', planId);
      
      try {
        const result = await this.service.getPlanImageWithSize(planId);
        
        if (!result || !result.imageUrl) {
          this.loading = false;
          return;
        }

        this.planImageUrl = result.imageUrl;
        this.xpsWidth = result.xpsWidth;
        this.xpsHeight = result.xpsHeight;
        
        const pointsData = await this.service.getPanorams(planId);
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
          this.loading = false;
        };
        img.src = this.planImageUrl;
        
        this.selectedHeight = savedHeight;
        this.selectedYear = savedYear;
        
      } catch (error) {
        console.error('Ошибка загрузки плана:', error);
        this.loading = false;
      }
    },

    async selectVersion(planId) {
      await this.switchToVersion(planId);
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
        setTimeout(() => { this.drawSector(); }, 100);
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
  font-size: 16px;
  font-weight: 700;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  flex: 1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.version-selectors {
  display: flex;
  align-items: center;
  gap: 4px;
}

.version-selector {
  position: relative;
  display: inline-block;
}

.version-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 11px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 40px;
}

.version-btn.height-btn {
  min-width: 40px;
  background: rgba(255, 193, 7, 0.15);
  border-color: rgba(255, 193, 7, 0.25);
}

.version-btn.year-btn {
  min-width: 50px;
  background: rgba(66, 133, 244, 0.2);
  border-color: rgba(66, 133, 244, 0.3);
}

.version-btn.height-btn:hover:not(:disabled) {
  background: rgba(255, 193, 7, 0.25);
}

.version-btn.year-btn:hover:not(:disabled) {
  background: rgba(66, 133, 244, 0.3);
}

.version-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.version-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.version-arrow {
  font-size: 8px;
  margin-left: 2px;
}

.version-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #1a1a2e;
  border: 1px solid #76528a;
  border-radius: 6px;
  min-width: 80px;
  max-height: 150px;
  overflow-y: auto;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.version-item {
  padding: 4px 10px;
  color: #ffffff;
  font-size: 11px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.version-item:hover {
  background: rgba(118, 82, 138, 0.3);
}

.version-item.active {
  background: rgba(118, 82, 138, 0.5);
  color: #ffffff;
}

.version-dropdown::-webkit-scrollbar {
  width: 4px;
}

.version-dropdown::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.version-dropdown::-webkit-scrollbar-thumb {
  background: #76528a;
  border-radius: 2px;
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

@media (max-width: 768px) {
  .plan-viewer.mobile {
    border-radius: 8px !important;
    border: 2px solid #76528a !important;
    min-width: 200px !important;
    min-height: 150px !important;
    max-width: 95vw !important;
    max-height: 80vh !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9) !important;
    backdrop-filter: blur(10px);
    background: #1a1a2e;
  }

  .plan-viewer.mobile .plan-header {
    cursor: move;
    height: 35px;
    min-height: 35px;
    background: rgba(70, 36, 103, 0.95);
  }

  .plan-viewer.mobile .plan-title {
    font-size: 13px;
  }

  .plan-viewer.mobile .plan-footer {
    display: block !important;
    height: 16px;
    min-height: 16px;
  }

  .plan-viewer.mobile .resize-handle {
    display: block !important;
  }

  .plan-viewer.mobile .point-dot {
    width: 20px;
    height: 20px;
    font-size: 10px;
  }

  .plan-viewer.mobile .version-btn {
    font-size: 9px;
    padding: 1px 5px;
    min-width: 30px;
  }

  .plan-viewer.mobile .version-dropdown {
    min-width: 60px;
    max-height: 120px;
  }

  .plan-viewer.mobile .version-item {
    font-size: 9px;
    padding: 3px 8px;
  }

  .plan-viewer.mobile .version-selectors {
    gap: 2px;
  }

  .show-plan-btn.mobile {
    width: 40px;
    height: 40px;
    font-size: 18px;
    bottom: 15px;
    left: 15px;
  }
}

@media (max-width: 480px) {
  .plan-viewer:not(.mobile) {
    min-width: 280px;
    min-height: 180px;
  }
}
</style> -->

<!-- <template>
  <div 
    v-if="visible"
    class="plan-viewer"
    :class="{ 'mobile': isMobile }"
    :style="{
      left: position.x + 'px',
      top: position.y + 'px',
      width: size.width + 'px',
      height: size.height + 'px'
    }"
  >
    <div class="plan-header" @mousedown="onHeaderMouseDown" @touchstart="onTouchStart">
      <span class="plan-title">{{ planTitle }}</span>
      <div class="header-actions">
        <div class="version-selector">
          <button 
            class="version-btn" 
            @click.stop="toggleVersionMenu"
            @touchstart.stop
            :disabled="versions.length <= 1"
          >
            {{ currentVersionLabel || 'Версия' }}
            <span v-if="versions.length > 1" class="version-arrow">▼</span>
          </button>
          <div v-if="showVersionMenu && versions.length > 1" class="version-dropdown" @click.stop>
            <div
              v-for="version in versions"
              :key="version.id"
              class="version-item"
              :class="{ active: version.id === currentPlanId }"
              @click="selectVersion(version.id)"
            >
              {{ version.label }}
            </div>
          </div>
        </div>
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
      <div class="resize-handle" 
           @mousedown.stop="onResizeStart" 
           @touchstart.stop="onResizeTouchStart">
      </div>
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

  <button 
    v-if="!visible && !isClosed"
    class="show-plan-btn"
    :class="{ 'mobile': isMobile }"
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
    },
    isMobile: {
      type: Boolean,
      default: false
    },
    allVersions: {
      type: Array,
      default: () => []
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
      
      isResizing: false,
      resizeStartX: 0,
      resizeStartY: 0,
      resizeStartWidth: 0,
      resizeStartHeight: 0,
      
      isResizingTouch: false,
      resizeTouchStartX: 0,
      resizeTouchStartY: 0,
      resizeTouchStartWidth: 0,
      resizeTouchStartHeight: 0,
      
      canvasReady: false,
      xpsWidth: null,
      xpsHeight: null,
      
      versions: [],
      currentVersionLabel: '',
      showVersionMenu: false,
      allPlans: [],
      currentPlanId: this.folderId,
    };
  },
  computed: {
    planTitle() {
      return this.folderName || 'План здания';
    }
  },
  watch: {
    currentAzimuth: {
      handler() { this.drawSector(); },
      immediate: true
    },
    activePointId: {
      handler() { this.drawSector(); },
      immediate: true
    },
    size: {
      handler() {
        this.$nextTick(() => { this.drawSector(); });
      },
      deep: true
    }
  },
  async mounted() {
    if (this.isMobile) {
      this.size.width = Math.min(window.innerWidth - 20, 500);
      this.size.height = Math.min(window.innerHeight - 100, 500);
      this.position.x = 10;
      this.position.y = 20;
    }
    
    this.service = new PanoramaService(this.objectsRepository);
    await this.loadPlan();
    
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
    window.addEventListener('resize', this.onWindowResize);
    
    if (this.isMobile) {
      window.addEventListener('touchmove', this.onTouchMove);
      window.addEventListener('touchend', this.onTouchEnd);
    }
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
    if (this.isMobile) {
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('touchend', this.onTouchEnd);
    }
  },
  methods: {
    async loadPlan() {
      this.loading = true;
      this.showVersionMenu = false;
      
      try {
        if (this.allVersions && this.allVersions.length > 0) {
          
          this.versions = this.allVersions.map(v => ({
            id: v.id,
            label: v.name || v.label || 'Версия',
            height: v.height,
            year: v.year,
            title: v.name || v.title
          }));
          this.allPlans = this.allVersions;
          
          // Находим текущий план
          const current = this.allVersions.find(v => v.id === this.folderId);
          if (current) {
            this.currentVersionLabel = current.name || current.label || 'Версия';
            this.currentPlanId = this.folderId;
          } else if (this.allVersions.length > 0) {
            const first = this.allVersions[0];
            this.currentVersionLabel = first.name || first.label || 'Версия';
            this.currentPlanId = first.id;
            if (first.id !== this.folderId) {
              this.folderId = first.id;
              this.folderName = first.name || 'План';
            }
          }
          
          console.log('📌 Текущая версия:', this.currentVersionLabel);
          console.log('📌 Текущий план ID:', this.currentPlanId);
          
        } else {
          // ===== ГРУППИРУЕМ ВНУТРИ ПАПКИ =====
          console.log('📂 Группируем внутри папки:', this.folderId);
          const grouped = await this.service.getGroupedPlans(this.folderId);
          console.log('📦 Сгруппированные планы:', grouped);
          
          let currentGroup = null;
          for (const [key, group] of Object.entries(grouped)) {
            if (group.plans.some(p => p.id === this.folderId)) {
              currentGroup = group;
              break;
            }
          }
          
          if (currentGroup) {
            this.versions = currentGroup.versions;
            this.allPlans = currentGroup.plans;
            
            const current = currentGroup.plans.find(p => p.id === this.folderId);
            if (current) {
              this.currentVersionLabel = this.service.getVersionLabel(current.height, current.year);
              this.currentPlanId = this.folderId;
            } else if (this.versions.length > 0) {
              const first = currentGroup.plans[0];
              this.currentVersionLabel = this.service.getVersionLabel(first.height, first.year);
              this.currentPlanId = first.id;
              if (first.id !== this.folderId) {
                this.folderId = first.id;
                this.folderName = first.title || 'План';
              }
            }
          } else {
            this.versions = [{
              id: this.folderId,
              label: this.folderName || 'План',
              height: null,
              year: null,
              title: this.folderName
            }];
            this.allPlans = [{
              id: this.folderId,
              title: this.folderName,
              year: null,
              height: null,
              _raw: null
            }];
            this.currentVersionLabel = this.folderName || 'План';
            this.currentPlanId = this.folderId;
          }
          
          console.log('📌 Версии из группировки:', this.versions);
          console.log('📌 Текущая метка:', this.currentVersionLabel);
        }
        
        // ===== ЗАГРУЗКА ИЗОБРАЖЕНИЯ ПЛАНА =====
        console.log('📥 Загрузка плана:', this.folderId);
        const result = await this.service.getPlanImageWithSize(this.folderId);
        
        if (!result || !result.imageUrl) {
          console.warn('⚠️ План не найден');
          this.loading = false;
          return;
        }

        this.planImageUrl = result.imageUrl;
        this.xpsWidth = result.xpsWidth;
        this.xpsHeight = result.xpsHeight;
        
        console.log('📐 Размеры XPS:', this.xpsWidth, 'x', this.xpsHeight);
        
        // ===== ЗАГРУЗКА ТОЧЕК =====
        const pointsData = await this.service.getPanorams(this.folderId);
        this.points = Object.values(pointsData);
        this.groupPoints();
        console.log('📍 Загружено точек:', this.points.length);
        
        // ===== ЗАГРУЗКА ИЗОБРАЖЕНИЯ В DOM =====
        const img = new Image();
        img.onload = () => {
          this.planWidth = img.width;
          this.planHeight = img.height;
          console.log('📐 Размеры PNG:', this.planWidth, 'x', this.planHeight);
          this.loading = false;
          this.$nextTick(() => {
            this.canvasReady = true;
            this.drawSector();
          });
        };
        img.onerror = () => {
          console.error('❌ Ошибка загрузки изображения');
          this.loading = false;
        };
        img.src = this.planImageUrl;
        
      } catch (error) {
        console.error('❌ Ошибка загрузки плана:', error);
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
      if (!this.planWidth || !this.planHeight) return { display: 'none' };
      const container = this.$refs.planContainer;
      if (!container) return { display: 'none' };
      
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
      this.$nextTick(() => { this.drawSector(); });
    },

    onTouchStart(event) {
      if (event.target.closest('button')) return;
      const touch = event.touches[0];
      this.isDraggingWindow = true;
      this.windowDragStartX = touch.clientX;
      this.windowDragStartY = touch.clientY;
      this.windowStartX = this.position.x;
      this.windowStartY = this.position.y;
    },

    onTouchMove(event) {
      if (this.isDraggingWindow && this.isMobile) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.windowDragStartX;
        const dy = touch.clientY - this.windowDragStartY;
        this.position.x = Math.max(0, this.windowStartX + dx);
        this.position.y = Math.max(0, this.windowStartY + dy);
      }
      if (this.isResizingTouch && this.isMobile) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.resizeTouchStartX;
        const dy = touch.clientY - this.resizeTouchStartY;
        const minWidth = 200;
        const minHeight = 150;
        const maxWidth = window.innerWidth - 20;
        const maxHeight = window.innerHeight - 50;
        this.size.width = Math.min(maxWidth, Math.max(minWidth, this.resizeTouchStartWidth + dx));
        this.size.height = Math.min(maxHeight, Math.max(minHeight, this.resizeTouchStartHeight + dy));
      }
    },

    onTouchEnd() {
      this.isDraggingWindow = false;
      this.isResizingTouch = false;
    },

    onResizeTouchStart(event) {
      event.stopPropagation();
      const touch = event.touches[0];
      this.isResizingTouch = true;
      this.resizeTouchStartX = touch.clientX;
      this.resizeTouchStartY = touch.clientY;
      this.resizeTouchStartWidth = this.size.width;
      this.resizeTouchStartHeight = this.size.height;
    },

    onHeaderMouseDown(event) {
      if (event.target.closest('button')) return;
      if (this.isMobile) return;
      this.isDraggingWindow = true;
      this.windowDragStartX = event.clientX;
      this.windowDragStartY = event.clientY;
      this.windowStartX = this.position.x;
      this.windowStartY = this.position.y;
    },

    onWindowMouseMove(event) {
      if (this.isDraggingWindow && !this.isMobile) {
        const dx = event.clientX - this.windowDragStartX;
        const dy = event.clientY - this.windowDragStartY;
        this.position.x = Math.max(0, this.windowStartX + dx);
        this.position.y = Math.max(0, this.windowStartY + dy);
      }
      if (this.isResizing && !this.isMobile) {
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
      if (this.isMobile) return;
      this.isResizing = true;
      this.resizeStartX = event.clientX;
      this.resizeStartY = event.clientY;
      this.resizeStartWidth = this.size.width;
      this.resizeStartHeight = this.size.height;
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
          let height = null;
          const currentPlan = this.allPlans.find(p => p.id === this.currentPlanId);
          if (currentPlan && currentPlan.height) {
            height = currentPlan.height;
          }
          if (!height && point.height) {
            height = point.height;
          }
          
          let date = null;
          const file = point._raw?.actualFileSnapshot?.files?.[0];
          if (file?.body?.created) {
            date = file.body.created;
          } else if (point._raw?.created) {
            date = point._raw.created;
          }
          
          this.$emit('open-panorama', {
            id: point.id,
            url: url,
            title: point.name || 'Панорама 360°',
            azimuth: point.azimuth || 0,
            height: height,
            date: date,
            year: currentPlan?.year || point.year || null
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

    toggleVersionMenu() {
      if (this.versions.length > 1) {
        this.showVersionMenu = !this.showVersionMenu;
      }
    },

    async selectVersion(planId) {
      console.log('🔄 selectVersion вызван, planId:', planId);
      this.showVersionMenu = false;
      
      if (planId === this.currentPlanId) {
        console.log('⚠️ План уже выбран');
        return;
      }
      
      const plan = this.allPlans.find(p => p.id === planId);
      if (!plan) {
        console.warn('❌ План не найден:', planId);
        return;
      }
      
      console.log('📄 Найден план:', plan);
      
      // Обновляем локальные данные
      this.currentPlanId = planId;
      this.currentVersionLabel = plan.label || plan.name || 'Версия';
      
      // Сбрасываем старые данные
      this.planImageUrl = null;
      this.planWidth = 0;
      this.planHeight = 0;
      this.points = [];
      this.groupedPoints = [];
      this.canvasReady = false;
      this.loading = true;
      
      // НЕ МЕНЯЕМ folderId напрямую — это пропс!
      // Вместо этого эмитим событие в родителя
      this.$emit('switch-plan', planId);
      
      // Перезагружаем план (loadPlan использует folderId из пропса,
      // который обновится через родителя)
      await this.loadPlan();
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
        setTimeout(() => { this.drawSector(); }, 100);
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
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

/* ===== СЕЛЕКТОР ВЕРСИЙ ===== */
.version-selector {
  position: relative;
  display: inline-block;
}

.version-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 12px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  padding: 2px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 60px;
}

.version-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.version-btn:disabled {
  opacity: 0.7;
  cursor: default;
}

.version-arrow {
  font-size: 10px;
  margin-left: 4px;
}

.version-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #1a1a2e;
  border: 1px solid #76528a;
  border-radius: 6px;
  min-width: 150px;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.version-item {
  padding: 6px 12px;
  color: #ffffff;
  font-size: 13px;
  font-family: 'GPN_DIN Condensed Bold', Arial, sans-serif;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.version-item:hover {
  background: rgba(118, 82, 138, 0.3);
}

.version-item.active {
  background: rgba(118, 82, 138, 0.5);
  color: #ffffff;
}

.version-dropdown::-webkit-scrollbar {
  width: 4px;
}

.version-dropdown::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.version-dropdown::-webkit-scrollbar-thumb {
  background: #76528a;
  border-radius: 2px;
}

/* ===== ОСТАЛЬНЫЕ СТИЛИ ===== */
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

/* ===== МОБИЛЬНАЯ ВЕРСИЯ ===== */
.plan-viewer.mobile {
  border-radius: 8px !important;
  border: 2px solid #76528a !important;
  min-width: 200px !important;
  min-height: 150px !important;
  max-width: 95vw !important;
  max-height: 80vh !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9) !important;
  backdrop-filter: blur(10px);
  background: #1a1a2e;
}

.plan-viewer.mobile .plan-header {
  cursor: move;
  height: 35px;
  min-height: 35px;
  background: rgba(70, 36, 103, 0.95);
}

.plan-viewer.mobile .plan-title {
  font-size: 14px;
}

.plan-viewer.mobile .plan-footer {
  display: block !important;
  height: 16px;
  min-height: 16px;
}

.plan-viewer.mobile .resize-handle {
  display: block !important;
}

.plan-viewer.mobile .point-dot {
  width: 20px;
  height: 20px;
  font-size: 10px;
}

.plan-viewer.mobile .version-btn {
  font-size: 10px;
  padding: 1px 6px;
}

.plan-viewer.mobile .version-dropdown {
  min-width: 120px;
  max-height: 150px;
}

.plan-viewer.mobile .version-item {
  font-size: 11px;
  padding: 4px 10px;
}

.show-plan-btn.mobile {
  width: 40px;
  height: 40px;
  font-size: 18px;
  bottom: 15px;
  left: 15px;
}

@media (max-width: 480px) {
  .plan-viewer:not(.mobile) {
    min-width: 280px;
    min-height: 180px;
  }
}
</style> -->

<!-- src/components/PlanViewer.vue -->
<!-- <template>
  <div 
    v-if="visible"
    class="plan-viewer"
    :class="{ 'mobile': isMobile }"
    :style="{
      left: position.x + 'px',
      top: position.y + 'px',
      width: size.width + 'px',
      height: size.height + 'px'
    }"
  >
    <div class="plan-header" @mousedown="onHeaderMouseDown" @touchstart="onTouchStart">
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
      <div class="resize-handle" 
           @mousedown.stop="onResizeStart" 
           @touchstart.stop="onResizeTouchStart">
      </div>
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

  <button 
    v-if="!visible && !isClosed"
    class="show-plan-btn"
    :class="{ 'mobile': isMobile }"
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
    },
    isMobile: {
      type: Boolean,
      default: false
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
      
      isResizing: false,
      resizeStartX: 0,
      resizeStartY: 0,
      resizeStartWidth: 0,
      resizeStartHeight: 0,
      
      // Для мобильного ресайза
      isResizingTouch: false,
      resizeTouchStartX: 0,
      resizeTouchStartY: 0,
      resizeTouchStartWidth: 0,
      resizeTouchStartHeight: 0,
      
      canvasReady: false,
      xpsWidth: null,
      xpsHeight: null
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
    // Настройка под мобилку
    if (this.isMobile) {
      this.size.width = Math.min(window.innerWidth - 20, 500);
      this.size.height = Math.min(window.innerHeight - 100, 500);
      this.position.x = 10;
      this.position.y = 20;
    }
    
    this.service = new PanoramaService(this.objectsRepository);
    await this.loadPlan();
    
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
    window.addEventListener('resize', this.onWindowResize);
    
    // Touch-события для мобилки
    if (this.isMobile) {
      window.addEventListener('touchmove', this.onTouchMove);
      window.addEventListener('touchend', this.onTouchEnd);
    }
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
    
    if (this.isMobile) {
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('touchend', this.onTouchEnd);
    }
  },
  methods: {
    async loadPlan() {
      this.loading = true;
      try {
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

    // Touch события для мобилки
    onTouchStart(event) {
      if (event.target.closest('button')) return;
      const touch = event.touches[0];
      this.isDraggingWindow = true;
      this.windowDragStartX = touch.clientX;
      this.windowDragStartY = touch.clientY;
      this.windowStartX = this.position.x;
      this.windowStartY = this.position.y;
    },

    onTouchMove(event) {
      // Перетаскивание окна
      if (this.isDraggingWindow && this.isMobile) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.windowDragStartX;
        const dy = touch.clientY - this.windowDragStartY;
        this.position.x = Math.max(0, this.windowStartX + dx);
        this.position.y = Math.max(0, this.windowStartY + dy);
      }
      
      // Ресайз окна
      if (this.isResizingTouch && this.isMobile) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.resizeTouchStartX;
        const dy = touch.clientY - this.resizeTouchStartY;
        
        const minWidth = 200;
        const minHeight = 150;
        const maxWidth = window.innerWidth - 20;
        const maxHeight = window.innerHeight - 50;
        
        this.size.width = Math.min(maxWidth, Math.max(minWidth, this.resizeTouchStartWidth + dx));
        this.size.height = Math.min(maxHeight, Math.max(minHeight, this.resizeTouchStartHeight + dy));
      }
    },

    onTouchEnd() {
      this.isDraggingWindow = false;
      this.isResizingTouch = false;
    },

    onResizeTouchStart(event) {
      event.stopPropagation();
      const touch = event.touches[0];
      this.isResizingTouch = true;
      this.resizeTouchStartX = touch.clientX;
      this.resizeTouchStartY = touch.clientY;
      this.resizeTouchStartWidth = this.size.width;
      this.resizeTouchStartHeight = this.size.height;
    },

    onHeaderMouseDown(event) {
      if (event.target.closest('button')) return;
      if (this.isMobile) return;
      this.isDraggingWindow = true;
      this.windowDragStartX = event.clientX;
      this.windowDragStartY = event.clientY;
      this.windowStartX = this.position.x;
      this.windowStartY = this.position.y;
    },

    onWindowMouseMove(event) {
      if (this.isDraggingWindow && !this.isMobile) {
        const dx = event.clientX - this.windowDragStartX;
        const dy = event.clientY - this.windowDragStartY;
        this.position.x = Math.max(0, this.windowStartX + dx);
        this.position.y = Math.max(0, this.windowStartY + dy);
      }
      
      if (this.isResizing && !this.isMobile) {
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
      if (this.isMobile) return;
      this.isResizing = true;
      this.resizeStartX = event.clientX;
      this.resizeStartY = event.clientY;
      this.resizeStartWidth = this.size.width;
      this.resizeStartHeight = this.size.height;
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
          // Парсим высоту из названия плана
          let height = null;
          const planTitle = this.folderName || '';
          
          // Проверяем исключение БОВ-8А
          if (planTitle.includes('БОВ-8А')) {
            height = null; // нет высоты
          } else {
            // Ищем паттерн ГП-секция-высота
            // Сначала пробуем найти через регулярку: ГП-{секция}-{высота}
            const match = planTitle.match(/^ГП-([^-]+)-(.+?)(?:\s|$)/);
            if (match) {
              height = match[2].trim();
            } else {
              // Если не нашли через регулярку, пробуем через split
              const parts = planTitle.split('-');
              if (parts.length >= 3) {
                // Берем все после второго тире до пробела или конца
                const heightPart = parts.slice(2).join('-');
                // Обрезаем год если есть
                const heightClean = heightPart.replace(/\s*\(20\d{2}\)\s*/, '').trim();
                if (heightClean) {
                  height = heightClean;
                }
              } else if (parts.length === 2) {
                const secondPart = parts[1];
                if (/^\d+\/\d+$/.test(secondPart)) {
                  height = secondPart;
                }
              }
            }
          }
          
          // Получаем дату из точки
          let date = null;
          const file = point._raw?.actualFileSnapshot?.files?.[0];
          if (file?.body?.created) {
            date = file.body.created;
          } else if (point._raw?.created) {
            date = point._raw.created;
          }
          
          this.$emit('open-panorama', {
            id: point.id,
            url: url,
            title: point.name || 'Панорама 360°',
            azimuth: point.azimuth || 0,
            height: height,
            date: date
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

/* ===== МОБИЛЬНАЯ ВЕРСИЯ ===== */
.plan-viewer.mobile {
  border-radius: 8px !important;
  border: 2px solid #76528a !important;
  min-width: 200px !important;
  min-height: 150px !important;
  max-width: 95vw !important;
  max-height: 80vh !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9) !important;
  backdrop-filter: blur(10px);
  background: #1a1a2e;
}

.plan-viewer.mobile .plan-header {
  cursor: move;
  height: 35px;
  min-height: 35px;
  background: rgba(70, 36, 103, 0.95);
}

.plan-viewer.mobile .plan-title {
  font-size: 14px;
}

.plan-viewer.mobile .plan-footer {
  display: block !important;
  height: 16px;
  min-height: 16px;
}

.plan-viewer.mobile .resize-handle {
  display: block !important;
}

.plan-viewer.mobile .point-dot {
  width: 20px;
  height: 20px;
  font-size: 10px;
}

.plan-viewer.mobile .direction-sector svg {
  width: 50px;
  height: 50px;
}

.show-plan-btn.mobile {
  width: 40px;
  height: 40px;
  font-size: 18px;
  bottom: 15px;
  left: 15px;
}

@media (max-width: 480px) {
  .plan-viewer:not(.mobile) {
    min-width: 280px;
    min-height: 180px;
  }
}
</style> -->