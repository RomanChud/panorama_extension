import JSZip from 'jszip';

export class PanoramaService {
  constructor(objectsRepository) {
    this.rootId = '88dfed13-f1a0-4735-b1fc-55a71743ea5b';
    this._objectsRepository = objectsRepository;
  }

  async getChildren(objectId) {
    try {
      if (!this._objectsRepository) {
        return [];
      }

      const objects = await this._objectsRepository.getObjects([objectId]).toPromise();
      if (!objects || objects.length === 0) {
        return [];
      }
      
      const obj = objects[0];
      if (!obj.children || obj.children.length === 0) return [];
      
      const childIds = obj.children.map(c => c.objectId).filter(Boolean);
      if (childIds.length === 0) return [];
      
      const children = await this._objectsRepository.getObjects(childIds).toPromise();
      return children || [];
    } catch (error) {
      console.error(`Ошибка получения детей для ${objectId}:`, error);
      return [];
    }
  }

  async getObject(objectId) {
    try {
      if (!this._objectsRepository) {
        return null;
      }
      const objects = await this._objectsRepository.getObjects([objectId]).toPromise();
      return objects?.[0] || null;
    } catch (error) {
      console.error(`Ошибка получения объекта ${objectId}:`, error);
      return null;
    }
  }

  async getProjects() {
    try {
      const allowedInstallations = ['УГК', 'УПВ', 'УПС', 'Л-24/5', 'СПК'];
      const ozhFolders = ['БДКВ', 'БОВ-8а', 'МЦК', 'ОСВ', 'ХВП', 'ХЖА'];
      
      const children = await this.getChildren(this.rootId);
      if (!children || children.length === 0) {
        return {};
      }
      
      const allProjects = {};
      for (const child of children) {
        const name = child.title || child.attributes?.name || '';
        if (!name || name === 'Без имени' || name === '' || name === 'Source files') continue;
        const typeName = child.type?.name || '';
        if (typeName === 'file' || typeName === 'document') continue;
        allProjects[name] = {
          id: child.id,
          name: name,
          type: typeName,
          _raw: child
        };
      }
      
      const projects = {};
      
      const hasPhoto360Folder = async (folderId) => {
        const children = await this.getChildren(folderId);
        if (!children || children.length === 0) return false;
        return children.some(c => 
          c.title?.includes('Фото 360') || c.name?.includes('Фото 360')
        );
      };
      
      for (const name of allowedInstallations) {
        const matchedKey = Object.keys(allProjects).find(key => key.includes(name));
        if (!matchedKey) continue;
        const project = allProjects[matchedKey];
        const hasFolder = await hasPhoto360Folder(project.id);
        if (hasFolder) {
          projects[project.id] = project;
        }
      }
      
      const ozhKey = Object.keys(allProjects).find(key => key.includes('ОЗХ'));
      if (ozhKey) {
        const ozhChildren = await this.getChildren(allProjects[ozhKey].id);
        const ozhMap = {};
        for (const child of ozhChildren) {
          const childName = child.title || child.name || '';
          if (child.type?.name === 'file') continue;
          ozhMap[childName] = child;
        }
        for (const name of ozhFolders) {
          if (ozhMap[name]) {
            const child = ozhMap[name];
            projects[child.id] = {
              id: child.id,
              name: name,
              type: 'project',
              _raw: child,
              isOZHChild: true 
            };
          }
        }
      }
      
      return projects;
    } catch (error) {
      console.error('Ошибка получения проектов:', error);
      return {};
    }
  }

  async getFolders(projectId) {
    try {
      const projectObj = await this.getObject(projectId);
      const projectName = projectObj?.title || projectObj?.name || '';

      const ozhFolders = ['БДКВ', 'БОВ-8а', 'МЦК', 'ОСВ', 'ХВП', 'ХЖА'];
      const isOZHProject = ozhFolders.some(name => projectName === name);
      
      const children = await this.getChildren(projectId);
      if (!children || children.length === 0) {
        return {};
      }
      
      let targetFolderId = null;
      let targetFolderName = '';
      
      if (isOZHProject) {
        targetFolderId = projectId;
        targetFolderName = projectName;
      } else {
        const photo360 = children.find(item => 
          item.title?.includes('Фото 360') || 
          item.name?.includes('Фото 360') ||
          item.title?.includes('Альбом Фото 360') ||
          item.name?.includes('Альбом Фото 360')
        );
        if (!photo360) {
          return {};
        }
        targetFolderId = photo360.id;
        targetFolderName = photo360.title || photo360.name || 'Фото 360';
      }
      
      const panoramaFolders = await this.getChildren(targetFolderId);
      if (!panoramaFolders || panoramaFolders.length === 0) {
        return {};
      }
      
      const folders = {};
      for (const folder of panoramaFolders) {
        const folderName = folder.title || folder.name || '';
        if (!folderName || folderName === 'Без имени' || folderName === 'Source files') continue;
        folders[folder.id] = {
          id: folder.id,
          name: folderName,
          _raw: folder
        };
      }
      
      return folders;
    } catch (error) {
      console.error(`Ошибка получения папок для проекта ${projectId}:`, error);
      return {};
    }
  }

  async getPanorams(folderId) {
    try {
      const children = await this.getChildren(folderId);
      if (!children || children.length === 0) {
        return {};
      }
      
      const points = {};
      const remarksFolders = children.filter(child => 
        child.type?.name === 'doc_remarksFolder' || child.typeId === 61
      );
      
      if (remarksFolders.length === 0) {
        const hasPoints = children.some(c => 
          c.type?.name === 'doc_photo360' || c.typeId === 89
        );
        if (hasPoints) {
          await this.processPoints(children, points);
          return points;
        }
        return {};
      }
      
      for (const remarksFolder of remarksFolders) {
        const remarksChildren = await this.getChildren(remarksFolder.id);
        if (!remarksChildren || remarksChildren.length === 0) continue;
        await this.processPoints(remarksChildren, points);
      }
      
      return points;
    } catch (error) {
      console.error(`Ошибка получения панорам из папки ${folderId}:`, error);
      return {};
    }
  }

  async processPoints(remarksChildren, points) {
    const promises = [];
    for (const remarkChild of remarksChildren) {
      const isPhoto360 = remarkChild.type?.name === 'doc_photo360';
      if (isPhoto360) {
        promises.push(this.processPoint(remarkChild));
      }
    }
    const results = await Promise.all(promises);
    for (const result of results) {
      if (result) {
        points[result.id] = result;
      }
    }
  }

  async processPoint(remarkChild) {
    const pointObj = await this.getObject(remarkChild.id);
    if (!pointObj) return null;
    const files = pointObj.actualFileSnapshot?.files || [];
    if (files.length === 0) return null;

    const annotation = pointObj.attributes?.annotation || '';
    let x = null, y = null, mark = null, page = null;
    const xMatch = annotation.match(/<PositionX>([^<]+)<\/PositionX>/);
    const yMatch = annotation.match(/<PositionY>([^<]+)<\/PositionY>/);
    const markMatch = annotation.match(/<Mark>([^<]+)<\/Mark>/);
    const pageMatch = annotation.match(/<PageNumber>([^<]+)<\/PageNumber>/);
    
    if (xMatch) x = parseFloat(xMatch[1]);
    if (yMatch) y = parseFloat(yMatch[1]);
    if (markMatch) mark = markMatch[1];
    if (pageMatch) page = parseInt(pageMatch[1]);

    const azimuth = pointObj.attributes?.azimuth || 0;
    const fileName = files[0]?.name || 'panorama.jpg';
    
    return {
      id: remarkChild.id,
      name: fileName.replace(/\.[^.]+$/, '') || 'Панорама 360°',
      url: null,
      fileName: fileName,
      x: x,
      y: y,
      azimuth: azimuth,
      mark: mark,
      page: page,
      _raw: pointObj
    };
  }

  // ===== ПАРСЕР НАЗВАНИЯ ПЛАНА =====
  parsePlanName(title, isUGK = false, isOZH = false) {
    if (!title) return null;

    const result = {
      fullTitle: title,
      baseName: title,
      section: null,
      height: null,
      year: null,
      suffix: ''
    };

    const yearMatch = title.match(/[(\s](20\d{2})[)\s]?/);
    if (yearMatch) {
      result.year = parseInt(yearMatch[1]);
    }

    let cleanTitle = title.replace(/\s*[(\s]20\d{2}[)\s]?/, '').trim();

    if (!cleanTitle) {
      result.baseName = title;
      return result;
    }

    // ===== ИСКЛЮЧЕНИЕ 1: УГК =====
    if (isUGK) {
      const ugkMatch = cleanTitle.match(/^ГП-(1|2\/11)$/i);
      if (ugkMatch) {
        return null
      }
    }

    // ===== ИСКЛЮЧЕНИЕ 2: ОЗХ БОВ-8А =====
    if (isOZH) {
      const bovMatch = cleanTitle.match(/^ГП-(БОВ-8А)$/i);
      if (bovMatch) {
        result.section = bovMatch[1];
        result.baseName = `ГП-${result.section}`;
        return result;
      }
    }

    // ===== ИСКЛЮЧЕНИЕ 3: ОЗХ остальные (буквенные секции) =====
    if (isOZH) {
      const ozhMatch = cleanTitle.match(/^ГП-([А-Я0-9\-]+)$/i);
      if (ozhMatch) {
        const section = ozhMatch[1];
        if (!/^\d+$/.test(section)) {
          result.section = section;
          result.baseName = `ГП-${result.section}`;
          return result;
        }
      }
    }

    // ===== ОСНОВНОЙ АЛГОРИТМ =====
    const parts = cleanTitle.split('-');

    if (parts.length >= 2 && parts[0].toUpperCase() === 'ГП') {
      const firstPart = parts[1];

      if (parts.length === 2) {
        const secondPart = parts[1];
        
        // Если это дробь - это высота без секции
        if (/^\d+\/\d+$/.test(secondPart)) {
          result.height = secondPart;
          result.baseName = 'ГП';
        } else {
          // Всё остальное - секция без высоты
          result.section = secondPart;
          result.baseName = `ГП-${result.section}`;
        }
      } else {
        // ГП-{секция}-{высота}
        result.section = firstPart;
        result.height = parts.slice(2).join('-');
        result.baseName = `ГП-${result.section}`;
      }
      return result;
    }

    result.baseName = cleanTitle;
    return result;
  }

  async getYearFromPoints(planId) {
    try {
      console.log(`🔍 Ищем год для плана ${planId}`);
      const points = await this.getPanorams(planId);
      const pointValues = Object.values(points);
      console.log(`📍 Найдено точек: ${pointValues.length}`);
      
      if (pointValues.length === 0) return null;
      
      const firstPoint = pointValues[0];
      console.log('📄 Первая точка:', firstPoint);
      
      const file = firstPoint._raw?.actualFileSnapshot?.files?.[0];
      console.log('📄 Файл:', file);
      
      if (file?.body?.created) {
        const date = new Date(file.body.created);
        console.log('📅 Дата из файла:', date);
        return date.getFullYear();
      }
      
      if (firstPoint._raw?.created) {
        const date = new Date(firstPoint._raw.created);
        console.log('📅 Дата из точки:', date);
        return date.getFullYear();
      }
      
      console.log('⚠️ Год не найден');
      return null;
    } catch (error) {
      console.error('Ошибка получения года из точек:', error);
      return null;
    }
  }

  // ===== ГРУППИРОВКА ПЛАНОВ =====
  async getGroupedPlans(folderId) {
    try {
      const children = await this.getChildren(folderId);
      if (!children || children.length === 0) {
        return {};
      }

      const folderData = await this.getObject(folderId);
      const folderName = folderData?.title || folderData?.name || '';
      
      const isUGK = folderName.includes('УГК');
      const isOZH = folderName.includes('БДКВ') || 
                    folderName.includes('БОВ-8а') || 
                    folderName.includes('ОСВ') || 
                    folderName.includes('ХВП') || 
                    folderName.includes('ХЖА');

      const grouped = {};

      for (const child of children) {
        const title = child.title || child.name || '';
        const planId = child.id;

        if (!title || title === 'Без имени' || title === 'Source files') continue;

        const files = child.actualFileSnapshot?.files || [];
        const hasPlanFile = files.some(f => f.name?.match(/\.(xps|pdf)$/i));
        if (!hasPlanFile) continue;

        const parsed = this.parsePlanName(title, isUGK, isOZH);
        if (!parsed || !parsed.baseName) continue;

        const key = parsed.baseName;

        if (!grouped[key]) {
          grouped[key] = {
            baseName: key,
            section: parsed.section,
            plans: [],
            versions: []
          };
        }

        let year = parsed.year;
        const height = parsed.height;

        if (!year) {
          year = await this.getYearFromPoints(planId);
        }

        grouped[key].plans.push({
          id: planId,
          title: title,
          year: year,
          height: height,
          section: parsed.section,
          created: child.created,
          _raw: child
        });

        let label = '';
        if (height) {
          label = height;
        } else if (year) {
          label = `${year}`;
        } else {
          label = title;
        }

        grouped[key].versions.push({
          id: planId,
          label: label,
          height: height,
          year: year,
          title: title
        });
      }

      for (const key of Object.keys(grouped)) {
        grouped[key].versions.sort((a, b) => {
          if (a.height !== b.height) {
            if (!a.height) return 1;
            if (!b.height) return -1;
            const aNum = parseFloat(a.height);
            const bNum = parseFloat(b.height);
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return aNum - bNum;
            }
            return a.height.localeCompare(b.height);
          }
          if (a.year !== b.year) {
            if (!a.year) return 1;
            if (!b.year) return -1;
            return a.year - b.year;
          }
          return 0;
        });
      }

      return grouped;
    } catch (error) {
      console.error('Ошибка группировки планов:', error);
      return {};
    }
  }

  async loadPanoramaFile(pointId) {
    return await this.downloadFile(pointId);
  }

  async downloadFile(pointId) {
    try {
      const formData = new URLSearchParams();
      formData.append('ids', pointId);
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
      
      if (!response.ok) {
        console.error(`HTTP ${response.status} для точки ${pointId}`);
        return null;
      }
      
      const buffer = await response.arrayBuffer();
      const isZip = this.isZipArchive(buffer);
      let imageData = null;
      
      if (isZip) {
        try {
          const zip = await JSZip.loadAsync(buffer);
          const files = Object.keys(zip.files);
          const imageFile = files.find(name => 
            name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && 
            !name.startsWith('__MACOSX/') && !name.includes('.DS_Store')
          );
          if (imageFile) {
            imageData = await zip.files[imageFile].async('arraybuffer');
          }
        } catch (e) {
          console.error('Ошибка распаковки ZIP:', e);
        }
      } else {
        imageData = buffer;
      }
      
      if (!imageData) return null;
      
      // ===== ОПРЕДЕЛЯЕМ ТИП УСТРОЙСТВА =====
      const ua = navigator.userAgent;
      const isIPhone = /iPhone|iPad|iPod/i.test(ua);
      const isAndroid = /Android/i.test(ua);
      const isMobile = isIPhone || isAndroid || /Mobi/i.test(ua);
      
      const memory = window.navigator?.deviceMemory || 0;
      const isLowMemory = memory > 0 && memory < 4;
      const isVeryLowMemory = memory > 0 && memory < 2;
      const isEmulator = /Emulator|SDK|Android SDK/i.test(ua);
      
      let shouldCompress = false;
      let maxSize = 2048;
      
      if (isMobile) {
        shouldCompress = true;
        
        if (isIPhone) {
          const match = ua.match(/iPhone(\d+)/);
          const model = match ? parseInt(match[1]) : 0;
          if (model > 0 && model < 14) {
            maxSize = 1536;
          } else if (model >= 14 && model <= 15) {
            maxSize = 2048;
          } else {
            maxSize = 2560;
          }
        } else if (isAndroid) {
          if (isVeryLowMemory || isLowMemory) {
            maxSize = 1536;
          } else {
            const androidMatch = ua.match(/Android\s([\d.]+)/);
            const androidVer = androidMatch ? parseFloat(androidMatch[1]) : 0;
            if (androidVer < 10) {
              maxSize = 1536;
            } else {
              maxSize = 2048;
            }
          }
        }
        
        if (isEmulator) {
          shouldCompress = false;
        }
      }
      
      // ===== СЖАТИЕ =====
      if (shouldCompress) {
        try {
          const compressed = await this.compressImage(imageData, maxSize);
          if (compressed) {
            console.log(`📱 Сжато для ${isIPhone ? 'iPhone' : 'Android'}, размер: ${maxSize}px`);
            return compressed;
          }
        } catch (e) {
          console.warn('Ошибка сжатия, используем оригинал:', e);
        }
      }
      
      // ===== БЕЗ СЖАТИЯ =====
      const bytes = new Uint8Array(imageData);
      let mimeType = 'image/jpeg';
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        mimeType = 'image/png';
      } else if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
        mimeType = 'image/jpeg';
      }
      
      const base64 = btoa(
        new Uint8Array(imageData).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error(`Ошибка скачивания для точки ${pointId}:`, error);
      return null;
    }
  }

  // ===== НОВЫЙ МЕТОД: СЖАТИЕ ИЗОБРАЖЕНИЯ =====
  async compressImage(arrayBuffer, maxSize = 2048) {
    try {
      const blob = new Blob([arrayBuffer]);
      const url = URL.createObjectURL(blob);
      
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Ошибка загрузки изображения'));
        image.src = url;
      });
      
      let width = img.width;
      let height = img.height;
      
      // Если изображение уже не больше maxSize - не сжимаем
      if (width <= maxSize && height <= maxSize) {
        URL.revokeObjectURL(url);
        return null;
      }
      
      // Вычисляем новые размеры с сохранением пропорций
      if (width > height) {
        const ratio = maxSize / width;
        width = maxSize;
        height = Math.round(height * ratio);
      } else {
        const ratio = maxSize / height;
        height = maxSize;
        width = Math.round(width * ratio);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      URL.revokeObjectURL(url);
      
      // Качество: для Android чуть ниже (экономия памяти)
      const ua = navigator.userAgent;
      const isAndroid = /Android/i.test(ua);
      const quality = isAndroid ? 0.75 : 0.85;
      
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      return dataUrl;
    } catch (e) {
      console.warn('Ошибка сжатия:', e);
      return null;
    }
  }

  isZipArchive(buffer) {
    try {
      const bytes = new Uint8Array(buffer.slice(0, 4));
      return bytes[0] === 0x50 && bytes[1] === 0x4B;
    } catch (e) {
      return false;
    }
  }

  async getPlanImageWithSize(folderId) {
    const imageUrl = await this.getPlanImage(folderId);
    if (!imageUrl) return { imageUrl: null, xpsWidth: null, xpsHeight: null };
    
    try {
      const folderData = await this.getObject(folderId);
      if (!folderData) return { imageUrl, xpsWidth: null, xpsHeight: null };
      
      const files = folderData.actualFileSnapshot?.files || [];
      const planFile = files.find(f => f.name?.match(/\.xps$/i));
      if (!planFile) return { imageUrl, xpsWidth: null, xpsHeight: null };
      
      const formData = new URLSearchParams();
      formData.append('ids', folderId);
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
      if (!xpsFile) return { imageUrl, xpsWidth: null, xpsHeight: null };
      
      const xpsBuffer = await zip.files[xpsFile].async('arraybuffer');
      const xpsZip = await JSZip.loadAsync(xpsBuffer);
      const fpageFile = Object.keys(xpsZip.files).find(name => name.match(/\.fpage$/i));
      
      if (fpageFile) {
        const fpageContent = await xpsZip.files[fpageFile].async('string');
        const widthMatch = fpageContent.match(/Width="([^"]+)"/);
        const heightMatch = fpageContent.match(/Height="([^"]+)"/);
        if (widthMatch && heightMatch) {
          return {
            imageUrl,
            xpsWidth: parseFloat(widthMatch[1]),
            xpsHeight: parseFloat(heightMatch[1])
          };
        }
      }
      return { imageUrl, xpsWidth: null, xpsHeight: null };
    } catch (error) {
      console.error('Ошибка получения размеров XPS:', error);
      return { imageUrl, xpsWidth: null, xpsHeight: null };
    }
  }

  async getPlanImage(folderId) {
    try {
      const folderData = await this.getObject(folderId);
      if (!folderData) {
        return null;
      }

      const files = folderData.actualFileSnapshot?.files || [];
      const planFile = files.find(f => f.name?.match(/\.(xps|pdf)$/i));
      if (!planFile) {
        return null;
      }

      const formData = new URLSearchParams();
      formData.append('ids', folderId);
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

      if (!response.ok) {
        console.error(`HTTP ${response.status}`);
        return null;
      }

      const buffer = await response.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const filesList = Object.keys(zip.files);
      const innerFile = filesList.find(name => name.match(/\.(xps|pdf)$/i));

      if (!innerFile) {
        return null;
      }

      const innerBuffer = await zip.files[innerFile].async('arraybuffer');

      if (innerFile.match(/\.pdf$/i)) {
        return await this.renderPdfToImage(innerBuffer);
      }

      if (innerFile.match(/\.xps$/i)) {
        const isZip = this.isZipArchive(innerBuffer);
        if (!isZip) {
          const blob = new Blob([innerBuffer]);
          return URL.createObjectURL(blob);
        }

        try {
          const xpsZip = await JSZip.loadAsync(innerBuffer);
          const xpsFiles = Object.keys(xpsZip.files);
          
          let imageFile = xpsFiles.find(name => 
            name.match(/Resources\/.*\.(png|jpg|jpeg)$/i)
          );
          
          if (!imageFile) {
            imageFile = xpsFiles.find(name => 
              name.match(/\.(png|jpg|jpeg)$/i)
            );
          }
          
          if (imageFile) {
            const imageData = await xpsZip.files[imageFile].async('blob');
            return URL.createObjectURL(imageData);
          } else {
            return null;
          }
        } catch (e) {
          console.error('Ошибка распаковки XPS:', e);
          return null;
        }
      }

      const blob = new Blob([innerBuffer]);
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Ошибка получения плана:', error);
      return null;
    }
  }

  async renderPdfToImage(pdfBuffer) {
    try {
      if (!window.pdfjsLib) await this.loadPdfJs();
      const pdf = await window.pdfjsLib.getDocument({ data: pdfBuffer }).promise;
      const page = await pdf.getPage(1);
      const scale = 1.5;
      const viewport = page.getViewport({ scale: scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Ошибка рендеринга PDF:', error);
      return null;
    }
  }

  async loadPdfJs() {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error('Не удалось загрузить pdf.js'));
      document.head.appendChild(script);
    });
  }

  clearUrls(points) {
    if (!points) return;
    for (const point of Object.values(points)) {
      if (point.url && point.url.startsWith('blob:')) {
        URL.revokeObjectURL(point.url);
      }
    }
  }
}




// import JSZip from 'jszip';

// export class PanoramaService {
//   constructor(objectsRepository) {
//     this.rootId = '88dfed13-f1a0-4735-b1fc-55a71743ea5b';
//     this._objectsRepository = objectsRepository;
//   }

//   async getChildren(objectId) {
//     try {
//       if (!this._objectsRepository) {
//         return [];
//       }

//       const objects = await this._objectsRepository.getObjects([objectId]).toPromise();
//       if (!objects || objects.length === 0) {
//         return [];
//       }
      
//       const obj = objects[0];
//       if (!obj.children || obj.children.length === 0) return [];
      
//       const childIds = obj.children.map(c => c.objectId).filter(Boolean);
//       if (childIds.length === 0) return [];
      
//       const children = await this._objectsRepository.getObjects(childIds).toPromise();
//       return children || [];
//     } catch (error) {
//       console.error(`Ошибка получения детей для ${objectId}:`, error);
//       return [];
//     }
//   }

//   async getObject(objectId) {
//     try {
//       if (!this._objectsRepository) {
//         return null;
//       }
//       const objects = await this._objectsRepository.getObjects([objectId]).toPromise();
//       return objects?.[0] || null;
//     } catch (error) {
//       console.error(`Ошибка получения объекта ${objectId}:`, error);
//       return null;
//     }
//   }

//   async getProjects() {
//     try {
//       const allowedInstallations = ['УГК', 'УПВ', 'УПС', 'Л-24/5', 'СПК'];
//       const ozhFolders = ['БДКВ', 'БОВ-8а', 'МЦК', 'ОСВ', 'ХВП', 'ХЖА'];
      
//       const children = await this.getChildren(this.rootId);
//       if (!children || children.length === 0) {
//         return {};
//       }
      
//       const allProjects = {};
//       for (const child of children) {
//         const name = child.title || child.attributes?.name || '';
//         if (!name || name === 'Без имени' || name === '' || name === 'Source files') continue;
//         const typeName = child.type?.name || '';
//         if (typeName === 'file' || typeName === 'document') continue;
//         allProjects[name] = {
//           id: child.id,
//           name: name,
//           type: typeName,
//           _raw: child
//         };
//       }
      
//       const projects = {};
      
//       const hasPhoto360Folder = async (folderId) => {
//         const children = await this.getChildren(folderId);
//         if (!children || children.length === 0) return false;
//         return children.some(c => 
//           c.title?.includes('Фото 360') || c.name?.includes('Фото 360')
//         );
//       };
      
//       for (const name of allowedInstallations) {
//         const matchedKey = Object.keys(allProjects).find(key => key.includes(name));
//         if (!matchedKey) continue;
//         const project = allProjects[matchedKey];
//         const hasFolder = await hasPhoto360Folder(project.id);
//         if (hasFolder) {
//           projects[project.id] = project;
//         }
//       }
      
//       const ozhKey = Object.keys(allProjects).find(key => key.includes('ОЗХ'));
//       if (ozhKey) {
//         const ozhChildren = await this.getChildren(allProjects[ozhKey].id);
//         const ozhMap = {};
//         for (const child of ozhChildren) {
//           const childName = child.title || child.name || '';
//           if (child.type?.name === 'file') continue;
//           ozhMap[childName] = child;
//         }
//         for (const name of ozhFolders) {
//           if (ozhMap[name]) {
//             const child = ozhMap[name];
//             projects[child.id] = {
//               id: child.id,
//               name: name,
//               type: 'project',
//               _raw: child,
//               isOZHChild: true 
//             };
//           }
//         }
//       }
      
//       return projects;
//     } catch (error) {
//       console.error('Ошибка получения проектов:', error);
//       return {};
//     }
//   }

//   async getFolders(projectId) {
//     try {
//       const projectObj = await this.getObject(projectId);
//       const projectName = projectObj?.title || projectObj?.name || '';

//       const ozhFolders = ['БДКВ', 'БОВ-8а', 'МЦК', 'ОСВ', 'ХВП', 'ХЖА'];
//       const isOZHProject = ozhFolders.some(name => projectName === name);
      
//       const children = await this.getChildren(projectId);
//       if (!children || children.length === 0) {
//         return {};
//       }
      
//       let targetFolderId = null;
//       let targetFolderName = '';
      
//       if (isOZHProject) {
//         targetFolderId = projectId;
//         targetFolderName = projectName;
//       } else {
//         const photo360 = children.find(item => 
//           item.title?.includes('Фото 360') || 
//           item.name?.includes('Фото 360') ||
//           item.title?.includes('Альбом Фото 360') ||
//           item.name?.includes('Альбом Фото 360')
//         );
//         if (!photo360) {
//           return {};
//         }
//         targetFolderId = photo360.id;
//         targetFolderName = photo360.title || photo360.name || 'Фото 360';
//       }
      
//       const panoramaFolders = await this.getChildren(targetFolderId);
//       if (!panoramaFolders || panoramaFolders.length === 0) {
//         return {};
//       }
      
//       const folders = {};
//       for (const folder of panoramaFolders) {
//         const folderName = folder.title || folder.name || '';
//         if (!folderName || folderName === 'Без имени' || folderName === 'Source files') continue;
//         folders[folder.id] = {
//           id: folder.id,
//           name: folderName,
//           _raw: folder
//         };
//       }
      
//       return folders;
//     } catch (error) {
//       console.error(`Ошибка получения папок для проекта ${projectId}:`, error);
//       return {};
//     }
//   }

//   async getPanorams(folderId) {
//     try {
//       const children = await this.getChildren(folderId);
//       if (!children || children.length === 0) {
//         return {};
//       }
      
//       const points = {};
//       const remarksFolders = children.filter(child => 
//         child.type?.name === 'doc_remarksFolder' || child.typeId === 61
//       );
      
//       if (remarksFolders.length === 0) {
//         const hasPoints = children.some(c => 
//           c.type?.name === 'doc_photo360' || c.typeId === 89
//         );
//         if (hasPoints) {
//           await this.processPoints(children, points);
//           return points;
//         }
//         return {};
//       }
      
//       for (const remarksFolder of remarksFolders) {
//         const remarksChildren = await this.getChildren(remarksFolder.id);
//         if (!remarksChildren || remarksChildren.length === 0) continue;
//         await this.processPoints(remarksChildren, points);
//       }
      
//       return points;
//     } catch (error) {
//       console.error(`Ошибка получения панорам из папки ${folderId}:`, error);
//       return {};
//     }
//   }

//   async processPoints(remarksChildren, points) {
//     const promises = [];
//     for (const remarkChild of remarksChildren) {
//       const isPhoto360 = remarkChild.type?.name === 'doc_photo360';
//       if (isPhoto360) {
//         promises.push(this.processPoint(remarkChild));
//       }
//     }
//     const results = await Promise.all(promises);
//     for (const result of results) {
//       if (result) {
//         points[result.id] = result;
//       }
//     }
//   }

//   async processPoint(remarkChild) {
//     const pointObj = await this.getObject(remarkChild.id);
//     if (!pointObj) return null;
//     const files = pointObj.actualFileSnapshot?.files || [];
//     if (files.length === 0) return null;

//     const annotation = pointObj.attributes?.annotation || '';
//     let x = null, y = null, mark = null, page = null;
//     const xMatch = annotation.match(/<PositionX>([^<]+)<\/PositionX>/);
//     const yMatch = annotation.match(/<PositionY>([^<]+)<\/PositionY>/);
//     const markMatch = annotation.match(/<Mark>([^<]+)<\/Mark>/);
//     const pageMatch = annotation.match(/<PageNumber>([^<]+)<\/PageNumber>/);
    
//     if (xMatch) x = parseFloat(xMatch[1]);
//     if (yMatch) y = parseFloat(yMatch[1]);
//     if (markMatch) mark = markMatch[1];
//     if (pageMatch) page = parseInt(pageMatch[1]);

//     const azimuth = pointObj.attributes?.azimuth || 0;
//     const fileName = files[0]?.name || 'panorama.jpg';
    
//     return {
//       id: remarkChild.id,
//       name: fileName.replace(/\.[^.]+$/, '') || 'Панорама 360°',
//       url: null,
//       fileName: fileName,
//       x: x,
//       y: y,
//       azimuth: azimuth,
//       mark: mark,
//       page: page,
//       _raw: pointObj
//     };
//   }

//   // ===== ПАРСЕР НАЗВАНИЯ ПЛАНА =====
//   parsePlanName(title, isUGK = false, isOZH = false) {
//     if (!title) return null;

//     const result = {
//       fullTitle: title,
//       baseName: title,
//       section: null,
//       height: null,
//       year: null,
//       suffix: ''
//     };

//     const yearMatch = title.match(/[(\s](20\d{2})[)\s]?/);
//     if (yearMatch) {
//       result.year = parseInt(yearMatch[1]);
//     }

//     let cleanTitle = title.replace(/\s*[(\s]20\d{2}[)\s]?/, '').trim();

//     if (!cleanTitle) {
//       result.baseName = title;
//       return result;
//     }

//     // ===== ИСКЛЮЧЕНИЕ 1: УГК =====
//     if (isUGK) {
//       const ugkMatch = cleanTitle.match(/^ГП-(1|2\/11)$/i);
//       if (ugkMatch) {
//         return null
//       }
//     }

//     // ===== ИСКЛЮЧЕНИЕ 2: ОЗХ БОВ-8А =====
//     if (isOZH) {
//       const bovMatch = cleanTitle.match(/^ГП-(БОВ-8А)$/i);
//       if (bovMatch) {
//         result.section = bovMatch[1];
//         result.baseName = `ГП-${result.section}`;
//         return result;
//       }
//     }

//     // ===== ИСКЛЮЧЕНИЕ 3: ОЗХ остальные (буквенные секции) =====
//     if (isOZH) {
//       const ozhMatch = cleanTitle.match(/^ГП-([А-Я0-9\-]+)$/i);
//       if (ozhMatch) {
//         const section = ozhMatch[1];
//         if (!/^\d+$/.test(section)) {
//           result.section = section;
//           result.baseName = `ГП-${result.section}`;
//           return result;
//         }
//       }
//     }

//     // ===== ОСНОВНОЙ АЛГОРИТМ =====
//     const parts = cleanTitle.split('-');

//     if (parts.length >= 2 && parts[0].toUpperCase() === 'ГП') {
//       const firstPart = parts[1];

//       if (parts.length === 2) {
//         const secondPart = parts[1];
        
//         // Если это дробь - это высота без секции
//         if (/^\d+\/\d+$/.test(secondPart)) {
//           result.height = secondPart;
//           result.baseName = 'ГП';
//         } else {
//           // Всё остальное - секция без высоты
//           result.section = secondPart;
//           result.baseName = `ГП-${result.section}`;
//         }
//       } else {
//         // ГП-{секция}-{высота}
//         result.section = firstPart;
//         result.height = parts.slice(2).join('-');
//         result.baseName = `ГП-${result.section}`;
//       }
//       return result;
//     }

//     result.baseName = cleanTitle;
//     return result;
//   }

//   async getYearFromPoints(planId) {
//   try {
//     console.log(`🔍 Ищем год для плана ${planId}`);
//     const points = await this.getPanorams(planId);
//     const pointValues = Object.values(points);
//     console.log(`📍 Найдено точек: ${pointValues.length}`);
    
//     if (pointValues.length === 0) return null;
    
//     const firstPoint = pointValues[0];
//     console.log('📄 Первая точка:', firstPoint);
    
//     const file = firstPoint._raw?.actualFileSnapshot?.files?.[0];
//     console.log('📄 Файл:', file);
    
//     if (file?.body?.created) {
//       const date = new Date(file.body.created);
//       console.log('📅 Дата из файла:', date);
//       return date.getFullYear();
//     }
    
//     if (firstPoint._raw?.created) {
//       const date = new Date(firstPoint._raw.created);
//       console.log('📅 Дата из точки:', date);
//       return date.getFullYear();
//     }
    
//     console.log('⚠️ Год не найден');
//     return null;
//   } catch (error) {
//     console.error('Ошибка получения года из точек:', error);
//     return null;
//   }
// }
//   // ===== ГРУППИРОВКА ПЛАНОВ =====
//   async getGroupedPlans(folderId) {
//     try {
//       const children = await this.getChildren(folderId);
//       if (!children || children.length === 0) {
//         return {};
//       }

//       const folderData = await this.getObject(folderId);
//       const folderName = folderData?.title || folderData?.name || '';
      
//       const isUGK = folderName.includes('УГК');
//       const isOZH = folderName.includes('БДКВ') || 
//                     folderName.includes('БОВ-8а') || 
//                     folderName.includes('ОСВ') || 
//                     folderName.includes('ХВП') || 
//                     folderName.includes('ХЖА');

//       const grouped = {};

//       for (const child of children) {
//         const title = child.title || child.name || '';
//         const planId = child.id;

//         if (!title || title === 'Без имени' || title === 'Source files') continue;

//         const files = child.actualFileSnapshot?.files || [];
//         const hasPlanFile = files.some(f => f.name?.match(/\.(xps|pdf)$/i));
//         if (!hasPlanFile) continue;

//         const parsed = this.parsePlanName(title, isUGK, isOZH);
//         if (!parsed || !parsed.baseName) continue;

//         const key = parsed.baseName;

//         if (!grouped[key]) {
//           grouped[key] = {
//             baseName: key,
//             section: parsed.section,
//             plans: [],
//             versions: []
//           };
//         }

//         let year = parsed.year;
//         const height = parsed.height;

//         if (!year) {
//           year = await this.getYearFromPoints(planId);
//         }

//         grouped[key].plans.push({
//           id: planId,
//           title: title,
//           year: year,
//           height: height,
//           section: parsed.section,
//           created: child.created,
//           _raw: child
//         });

//         let label = '';
//         if (height) {
//           label = height;
//         } else if (year) {
//           label = `${year}`;
//         } else {
//           label = title;
//         }

//         grouped[key].versions.push({
//           id: planId,
//           label: label,
//           height: height,
//           year: year,
//           title: title
//         });
//       }

//       for (const key of Object.keys(grouped)) {
//         grouped[key].versions.sort((a, b) => {
//           if (a.height !== b.height) {
//             if (!a.height) return 1;
//             if (!b.height) return -1;
//             const aNum = parseFloat(a.height);
//             const bNum = parseFloat(b.height);
//             if (!isNaN(aNum) && !isNaN(bNum)) {
//               return aNum - bNum;
//             }
//             return a.height.localeCompare(b.height);
//           }
//           if (a.year !== b.year) {
//             if (!a.year) return 1;
//             if (!b.year) return -1;
//             return a.year - b.year;
//           }
//           return 0;
//         });
//       }

//       return grouped;
//     } catch (error) {
//       console.error('Ошибка группировки планов:', error);
//       return {};
//     }
//   }

//   async loadPanoramaFile(pointId) {
//     return await this.downloadFile(pointId);
//   }

//   // async downloadFile(pointId) {
//   //   try {
//   //     const formData = new URLSearchParams();
//   //     formData.append('ids', pointId);
//   //     formData.append('signatures', '1');
//   //     formData.append('printPreview', '1');
//   //     formData.append('annotationsFilter', '');
//   //     formData.append('coincidenceOfNames', '1');
      
//   //     const response = await fetch('/api/Files/GetFileArchive', {
//   //       method: 'POST',
//   //       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//   //       body: formData,
//   //       credentials: 'include'
//   //     });
      
//   //     if (!response.ok) {
//   //       console.error(`HTTP ${response.status} для точки ${pointId}`);
//   //       return null;
//   //     }
      
//   //     const buffer = await response.arrayBuffer();
//   //     const isZip = this.isZipArchive(buffer);
//   //     let imageData = null;
      
//   //     if (isZip) {
//   //       try {
//   //         const zip = await JSZip.loadAsync(buffer);
//   //         const files = Object.keys(zip.files);
//   //         const imageFile = files.find(name => 
//   //           name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && 
//   //           !name.startsWith('__MACOSX/') && !name.includes('.DS_Store')
//   //         );
//   //         if (imageFile) {
//   //           imageData = await zip.files[imageFile].async('arraybuffer');
//   //         }
//   //       } catch (e) {
//   //         console.error('Ошибка распаковки ZIP:', e);
//   //       }
//   //     } else {
//   //       imageData = buffer;
//   //     }
      
//   //     if (!imageData) return null;
      
//   //     const bytes = new Uint8Array(imageData);
//   //     let mimeType = 'image/jpeg';
//   //     if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
//   //       mimeType = 'image/png';
//   //     } else if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
//   //       mimeType = 'image/jpeg';
//   //     }
      
//   //     const base64 = btoa(
//   //       new Uint8Array(imageData).reduce((data, byte) => data + String.fromCharCode(byte), '')
//   //     );
//   //     return `data:${mimeType};base64,${base64}`;
//   //   } catch (error) {
//   //     console.error(`Ошибка скачивания для точки ${pointId}:`, error);
//   //     return null;
//   //   }
//   // }

//   // PanoramaService.js — добавить в downloadFile после получения imageData

// async downloadFile(pointId) {
//   try {
//     const formData = new URLSearchParams();
//     formData.append('ids', pointId);
//     formData.append('signatures', '1');
//     formData.append('printPreview', '1');
//     formData.append('annotationsFilter', '');
//     formData.append('coincidenceOfNames', '1');
    
//     const response = await fetch('/api/Files/GetFileArchive', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//       body: formData,
//       credentials: 'include'
//     });
    
//     if (!response.ok) {
//       console.error(`HTTP ${response.status} для точки ${pointId}`);
//       return null;
//     }
    
//     const buffer = await response.arrayBuffer();
//     const isZip = this.isZipArchive(buffer);
    
//     if (isZip) {
//       try {
//         const zip = await JSZip.loadAsync(buffer);
//         const files = Object.keys(zip.files);
//         const imageFile = files.find(name => 
//           name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && 
//           !name.startsWith('__MACOSX/') && !name.includes('.DS_Store')
//         );
//         if (imageFile) {
//           const blob = await zip.files[imageFile].async('blob');
//           return URL.createObjectURL(blob);
//         }
//         // Если не нашли картинку - берем первый файл
//         const firstFile = files.find(f => 
//           !f.startsWith('__MACOSX/') && 
//           !f.includes('.DS_Store') &&
//           !f.endsWith('/')
//         );
//         if (firstFile) {
//           const blob = await zip.files[firstFile].async('blob');
//           return URL.createObjectURL(blob);
//         }
//       } catch (e) {
//         console.error('Ошибка распаковки ZIP:', e);
//       }
//     } else {
//       const blob = new Blob([buffer]);
//       return URL.createObjectURL(blob);
//     }
    
//     return null;
//   } catch (error) {
//     console.error(`Ошибка скачивания для точки ${pointId}:`, error);
//     return null;
//   }
// }

// // ===== НОВЫЙ МЕТОД: СЖАТИЕ ИЗОБРАЖЕНИЯ =====
// async compressImage(arrayBuffer) {
//   try {
//     const blob = new Blob([arrayBuffer]);
//     const url = URL.createObjectURL(blob);
    
//     const img = await new Promise((resolve, reject) => {
//       const image = new Image();
//       image.onload = () => resolve(image);
//       image.onerror = reject;
//       image.src = url;
//     });
    
//     // Уменьшаем до 2048px по ширине (для панорам это нормально)
//     const maxWidth = 2048;
//     let width = img.width;
//     let height = img.height;
    
//     if (width > maxWidth) {
//       const ratio = maxWidth / width;
//       width = maxWidth;
//       height = Math.round(height * ratio);
//     }
    
//     const canvas = document.createElement('canvas');
//     canvas.width = width;
//     canvas.height = height;
//     const ctx = canvas.getContext('2d');
//     ctx.drawImage(img, 0, 0, width, height);
    
//     URL.revokeObjectURL(url);
    
//     // Конвертируем в JPEG с качеством 85%
//     const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
//     return dataUrl;
//   } catch (e) {
//     console.warn('Ошибка сжатия:', e);
//     return null;
//   }
// }

//   isZipArchive(buffer) {
//     try {
//       const bytes = new Uint8Array(buffer.slice(0, 4));
//       return bytes[0] === 0x50 && bytes[1] === 0x4B;
//     } catch (e) {
//       return false;
//     }
//   }

//   async getPlanImageWithSize(folderId) {
//     const imageUrl = await this.getPlanImage(folderId);
//     if (!imageUrl) return { imageUrl: null, xpsWidth: null, xpsHeight: null };
    
//     try {
//       const folderData = await this.getObject(folderId);
//       if (!folderData) return { imageUrl, xpsWidth: null, xpsHeight: null };
      
//       const files = folderData.actualFileSnapshot?.files || [];
//       const planFile = files.find(f => f.name?.match(/\.xps$/i));
//       if (!planFile) return { imageUrl, xpsWidth: null, xpsHeight: null };
      
//       const formData = new URLSearchParams();
//       formData.append('ids', folderId);
//       formData.append('signatures', '1');
//       formData.append('printPreview', '1');
//       formData.append('annotationsFilter', '');
//       formData.append('coincidenceOfNames', '1');
      
//       const response = await fetch('/api/Files/GetFileArchive', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//         body: formData,
//         credentials: 'include'
//       });
      
//       const buffer = await response.arrayBuffer();
//       const zip = await JSZip.loadAsync(buffer);
//       const xpsFile = Object.keys(zip.files).find(name => name.match(/\.xps$/i));
//       if (!xpsFile) return { imageUrl, xpsWidth: null, xpsHeight: null };
      
//       const xpsBuffer = await zip.files[xpsFile].async('arraybuffer');
//       const xpsZip = await JSZip.loadAsync(xpsBuffer);
//       const fpageFile = Object.keys(xpsZip.files).find(name => name.match(/\.fpage$/i));
      
//       if (fpageFile) {
//         const fpageContent = await xpsZip.files[fpageFile].async('string');
//         const widthMatch = fpageContent.match(/Width="([^"]+)"/);
//         const heightMatch = fpageContent.match(/Height="([^"]+)"/);
//         if (widthMatch && heightMatch) {
//           return {
//             imageUrl,
//             xpsWidth: parseFloat(widthMatch[1]),
//             xpsHeight: parseFloat(heightMatch[1])
//           };
//         }
//       }
//       return { imageUrl, xpsWidth: null, xpsHeight: null };
//     } catch (error) {
//       console.error('Ошибка получения размеров XPS:', error);
//       return { imageUrl, xpsWidth: null, xpsHeight: null };
//     }
//   }

//   async getPlanImage(folderId) {
//     try {
//       const folderData = await this.getObject(folderId);
//       if (!folderData) {
//         return null;
//       }

//       const files = folderData.actualFileSnapshot?.files || [];
//       const planFile = files.find(f => f.name?.match(/\.(xps|pdf)$/i));
//       if (!planFile) {
//         return null;
//       }

//       const formData = new URLSearchParams();
//       formData.append('ids', folderId);
//       formData.append('signatures', '1');
//       formData.append('printPreview', '1');
//       formData.append('annotationsFilter', '');
//       formData.append('coincidenceOfNames', '1');
      
//       const response = await fetch('/api/Files/GetFileArchive', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//         body: formData,
//         credentials: 'include'
//       });

//       if (!response.ok) {
//         console.error(`HTTP ${response.status}`);
//         return null;
//       }

//       const buffer = await response.arrayBuffer();
//       const zip = await JSZip.loadAsync(buffer);
//       const filesList = Object.keys(zip.files);
//       const innerFile = filesList.find(name => name.match(/\.(xps|pdf)$/i));

//       if (!innerFile) {
//         return null;
//       }

//       const innerBuffer = await zip.files[innerFile].async('arraybuffer');

//       if (innerFile.match(/\.pdf$/i)) {
//         return await this.renderPdfToImage(innerBuffer);
//       }

//       if (innerFile.match(/\.xps$/i)) {
//         const isZip = this.isZipArchive(innerBuffer);
//         if (!isZip) {
//           const blob = new Blob([innerBuffer]);
//           return URL.createObjectURL(blob);
//         }

//         try {
//           const xpsZip = await JSZip.loadAsync(innerBuffer);
//           const xpsFiles = Object.keys(xpsZip.files);
          
//           let imageFile = xpsFiles.find(name => 
//             name.match(/Resources\/.*\.(png|jpg|jpeg)$/i)
//           );
          
//           if (!imageFile) {
//             imageFile = xpsFiles.find(name => 
//               name.match(/\.(png|jpg|jpeg)$/i)
//             );
//           }
          
//           if (imageFile) {
//             const imageData = await xpsZip.files[imageFile].async('blob');
//             return URL.createObjectURL(imageData);
//           } else {
//             return null;
//           }
//         } catch (e) {
//           console.error('Ошибка распаковки XPS:', e);
//           return null;
//         }
//       }

//       const blob = new Blob([innerBuffer]);
//       return URL.createObjectURL(blob);
//     } catch (error) {
//       console.error('Ошибка получения плана:', error);
//       return null;
//     }
//   }

//   async renderPdfToImage(pdfBuffer) {
//     try {
//       if (!window.pdfjsLib) await this.loadPdfJs();
//       const pdf = await window.pdfjsLib.getDocument({ data: pdfBuffer }).promise;
//       const page = await pdf.getPage(1);
//       const scale = 1.5;
//       const viewport = page.getViewport({ scale: scale });
//       const canvas = document.createElement('canvas');
//       const context = canvas.getContext('2d');
//       canvas.width = viewport.width;
//       canvas.height = viewport.height;
//       await page.render({ canvasContext: context, viewport: viewport }).promise;
//       return canvas.toDataURL('image/png');
//     } catch (error) {
//       console.error('Ошибка рендеринга PDF:', error);
//       return null;
//     }
//   }

//   async loadPdfJs() {
//     return new Promise((resolve, reject) => {
//       if (window.pdfjsLib) {
//         resolve(window.pdfjsLib);
//         return;
//       }
//       const script = document.createElement('script');
//       script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
//       script.async = true;
//       script.onload = () => {
//         window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
//         resolve(window.pdfjsLib);
//       };
//       script.onerror = () => reject(new Error('Не удалось загрузить pdf.js'));
//       document.head.appendChild(script);
//     });
//   }

//   clearUrls(points) {
//     if (!points) return;
//     for (const point of Object.values(points)) {
//       if (point.url && point.url.startsWith('blob:')) {
//         URL.revokeObjectURL(point.url);
//       }
//     }
//   }
// }