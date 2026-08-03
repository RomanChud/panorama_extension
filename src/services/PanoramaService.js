// src/services/PanoramaService.js

import JSZip from 'jszip';

export class PanoramaService {
  constructor(objectsRepository) {
    this.rootId = '88dfed13-f1a0-4735-b1fc-55a71743ea5b';
    this._objectsRepository = objectsRepository;
  }

  async getChildren(objectId, type = 1) {
    try {
      
      if (!this._objectsRepository) {
        console.error('objectsRepository не инициализирован!');
        return [];
      }

      const objects = await this._objectsRepository.getObjects([objectId]).toPromise();
      if (!objects || objects.length === 0) {
        console.warn(`Объект ${objectId} не найден`);
        return [];
      }
      
      const obj = objects[0];
      
      if (!obj.children || obj.children.length === 0) {
        return [];
      }
      
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
        console.error('objectsRepository не инициализирован!');
        return null;
      }
      const objects = await this._objectsRepository.getObjects([objectId]).toPromise();
      return objects?.[0] || null;
    } catch (error) {
      console.error(`Ошибка получения объекта ${objectId}:`, error);
      return null;
    }
  }

  // async getProjects() {
  //   try {
  //     const allowedInstallations = [
  //       'УГК', 'УПВ', 'УПС', 'Л-24/5', 'СПК', 
  //       'БДКВ', 'БОВ-8а', 'МЦК', 'ОСВ', 'ХВП', 'ХЖА'
  //     ];
      
  //     const children = await this.getChildren(this.rootId);
  //     if (!children || children.length === 0) {
  //       console.warn('нет доступа к корневой папке или она пуста');
  //       return {};
  //     }
      
  //     const allProjects = {};
  //     for (const child of children) {
  //       const name = child.title || child.attributes?.name || '';
  //       if (!name || name === 'Без имени' || name === '' || name === 'Source files') continue;
  //       const typeName = child.type?.name || '';
  //       if (typeName === 'file' || typeName === 'document') continue;
        
  //       allProjects[name] = {
  //         id: child.id,
  //         name: name,
  //         type: typeName,
  //         _raw: child
  //       };
  //     }
      
  //     const projects = {};
  //     for (const name of allowedInstallations) {
  //       // Ищем проект, название которого содержит искомую строку
  //       const matchedKey = Object.keys(allProjects).find(key => 
  //         key.includes(name)
  //       );
        
  //       if (matchedKey) {
  //         projects[allProjects[matchedKey].id] = allProjects[matchedKey];
  //       }
  //     }
      
  //     return projects;
  //   } catch (error) {
  //     console.error('Ошибка получения проектов:', error);
  //     return {};
  //   }
  // }

  // async getFolders(projectId) {
  //   try {
  //     const children = await this.getChildren(projectId);
  //     if (!children || children.length === 0) {
  //       console.warn(`Нет доступа к проекту ${projectId} или он пуст`);
  //       return {};
  //     }
      
  //     const photo360 = children.find(item => 
  //       item.title?.includes('Фото 360') || item.name?.includes('Фото 360')
  //     );
      
  //     if (!photo360) {
  //       console.warn(`Папка "Фото 360" не найдена в проекте ${projectId}`);
  //       return {};
  //     }
      
  //     const panoramaFolders = await this.getChildren(photo360.id);
  //     if (!panoramaFolders || panoramaFolders.length === 0) {
  //       console.warn(`Папка "Фото 360" пуста или нет доступа`);
  //       return {};
  //     }
      
  //     const folders = {};
  //     for (const folder of panoramaFolders) {
  //       const folderName = folder.title || folder.name || 'Без имени';
  //       folders[folder.id] = {
  //         id: folder.id,
  //         name: folderName,
  //         _raw: folder
  //       };
  //     }

  //     return folders;
  //   } catch (error) {
  //     console.error(`Ошибка получения папок для проекта ${projectId}:`, error);
  //     return {};
  //   }
  // }

  async getProjects() {
    try {
      const allowedInstallations = [
        'УГК', 'УПВ', 'УПС', 'Л-24/5', 'СПК'
      ];
      
      const ozhFolders = ['БДКВ', 'БОВ-8а', 'МЦК', 'ОСВ', 'ХВП', 'ХЖА'];
      
      const children = await this.getChildren(this.rootId);
      if (!children || children.length === 0) {
        console.warn('нет доступа к корневой папке или она пуста');
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

      for (const name of allowedInstallations) {
        const matchedKey = Object.keys(allProjects).find(key => key.includes(name));
        if (matchedKey) {
          projects[allProjects[matchedKey].id] = allProjects[matchedKey];
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
        
        // Добавляем в правильном порядке
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
        console.warn(`Нет доступа к проекту ${projectId} или он пуст`);
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
          console.warn(`Папка "Фото 360" не найдена в проекте ${projectName}`);
          return {};
        }
        
        targetFolderId = photo360.id;
        targetFolderName = photo360.title || photo360.name || 'Фото 360';
      }
      
      // Получаем детей папки (планы) — ОДИН ЗАПРОС
      const panoramaFolders = await this.getChildren(targetFolderId);
      if (!panoramaFolders || panoramaFolders.length === 0) {
        console.warn(`Папка "${targetFolderName}" пуста или нет доступа`);
        return {};
      }
      
      // Возвращаем ВСЕ папки без дополнительной проверки
      const folders = {};
      for (const folder of panoramaFolders) {
        const folderName = folder.title || folder.name || 'Без имени';
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
  // async getPanorams(folderId) {
  //   try {
  //     const children = await this.getChildren(folderId);
  //     if (!children || children.length === 0) {
  //       console.warn(`Нет доступа к папке ${folderId} или она пуста`);
  //       return {};
  //     }
      
  //     const points = {};
      
  //     const remarksFolder = children.find(child => 
  //       child.type?.name === 'doc_remarksFolder'
  //     );
      
  //     if (!remarksFolder) {
  //       console.warn(`Папка замечаний не найдена в ${folderId}`);
  //     } else {
  //       const remarksChildren = await this.getChildren(remarksFolder.id);
  //       if (!remarksChildren || remarksChildren.length === 0) {
  //         console.warn(`Папка замечаний пуста или нет доступа`);
  //         return {};
  //       }
  //       await this.processPoints(remarksChildren, points);
  //     }
      
  //     return points;
  //   } catch (error) {
  //     console.error(`Ошибка получения панорам из папки ${folderId}:`, error);
  //     return {};
  //   }
  // }       

  async getPanorams(folderId) {
    try {
      const children = await this.getChildren(folderId);
      if (!children || children.length === 0) {
        console.warn(`Нет доступа к папке ${folderId} или она пуста`);
        return {};
      }
      
      const points = {};
      
      const remarksFolders = children.filter(child => 
        child.type?.name === 'doc_remarksFolder' || child.typeId === 61
      );
      
      if (remarksFolders.length === 0) {
        console.warn(`Папка замечаний не найдена в ${folderId}`);
        
        // Проверяем, может быть это папка ОЗХ (сразу точки внутри)
        const hasPoints = children.some(c => 
          c.type?.name === 'doc_photo360' || c.typeId === 89
        );
        
        if (hasPoints) {
          await this.processPoints(children, points);
          return points;
        }
        
        return {};
      }
      
      // Обрабатываем каждую папку замечаний
      for (const remarksFolder of remarksFolders) {
        const remarksChildren = await this.getChildren(remarksFolder.id);
        if (!remarksChildren || remarksChildren.length === 0) {
          console.warn(`Папка замечаний ${remarksFolder.id} пуста`);
          continue;
        }
        
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

    // Азимут берем из attributes самой точки
    const azimuth = pointObj.attributes?.azimuth || 0;

    let fileName = files[0]?.name || 'panorama.jpg';
    try {
      fileName = decodeURIComponent(escape(fileName));
    } catch (e) {}

    // Декодируем название точки
    let pointName = pointObj.title || '';
    try {
      pointName = decodeURIComponent(escape(pointName));
    } catch (e) {}

    // Используем pointName если есть, иначе имя файла без расширения
    const displayName = pointName || fileName.replace(/\.[^.]+$/, '') || 'Панорама 360°';

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

  async loadPanoramaFile(pointId) {
    const fileUrl = await this.downloadFile(pointId);
    return fileUrl;
  }

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
  //       headers: { 
  //         'Content-Type': 'application/x-www-form-urlencoded',
  //         'X-Requested-With': 'XMLHttpRequest'
  //       },
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
  //           const imageData = await zip.files[imageFile].async('blob');
  //           return URL.createObjectURL(imageData);
  //         } else {
  //           console.warn('В ZIP нет изображений');
  //           const firstFile = files.find(f => !f.startsWith('__MACOSX/') && !f.includes('.DS_Store'));
  //           if (firstFile) {
  //             const fileData = await zip.files[firstFile].async('blob');
  //             return URL.createObjectURL(fileData);
  //           }
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
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
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
            const data = await zip.files[imageFile].async('arraybuffer');
            imageData = data;
          }
        } catch (e) {
          console.error('Ошибка распаковки ZIP:', e);
        }
      } else {
        imageData = buffer;
      }
      
      if (!imageData) return null;
      
      const bytes = new Uint8Array(imageData);
      let mimeType = 'image/jpeg';
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        mimeType = 'image/png';
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        mimeType = 'image/gif';
      } else if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
        mimeType = 'image/bmp';
      } else if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
        mimeType = 'image/jpeg';
      } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        mimeType = 'image/webp';
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

  isZipArchive(buffer) {
    try {
      const bytes = new Uint8Array(buffer.slice(0, 4));
      return bytes[0] === 0x50 && bytes[1] === 0x4B;
    } catch (e) {
      return false;
    }
  }

  clearUrls(points) {
    if (!points) return;
    for (const point of Object.values(points)) {
      if (point.url && point.url.startsWith('blob:')) {
        URL.revokeObjectURL(point.url);
      }
    }
  }

  async renderPdfToImage(pdfBuffer) {
    try {
      if (!window.pdfjsLib) {
        await this.loadPdfJs();
      }

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

  async getPlanImage(folderId) {
    
    try {
      const folderData = await this.getObject(folderId);
      if (!folderData) {
        console.warn('Папка не найдена');
        return null;
      }

      const files = folderData.actualFileSnapshot?.files || [];
      const planFile = files.find(f => 
        f.name?.match(/\.(xps|pdf)$/i)
      );

      if (!planFile) {
        console.warn('Файл плана (XPS/PDF) не найден');
        return null;
      }

      const fileName = planFile.name;

      const formData = new URLSearchParams();
      formData.append('ids', folderId);
      formData.append('signatures', '1');
      formData.append('printPreview', '1');
      formData.append('annotationsFilter', '');
      formData.append('coincidenceOfNames', '1');
      
      const response = await fetch('/api/Files/GetFileArchive', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
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

      const innerFile = filesList.find(name => 
        name.match(/\.(xps|pdf)$/i)
      );

      if (!innerFile) {
        console.warn('Внутри архива нет XPS/PDF');
        return null;
      }

      const innerBuffer = await zip.files[innerFile].async('arraybuffer');

      if (innerFile.match(/\.pdf$/i)) {
        return await this.renderPdfToImage(innerBuffer);
      }

      if (innerFile.match(/\.xps$/i)) {
        
        const isZip = this.isZipArchive(innerBuffer);
        if (!isZip) {
          console.warn('XPS файл не является ZIP архивом');
          const blob = new Blob([innerBuffer]);
          return URL.createObjectURL(blob);
        }

        try {
          const xpsZip = await JSZip.loadAsync(innerBuffer);
          const xpsFiles = Object.keys(xpsZip.files);

          let pngFile = xpsFiles.find(name => 
            name.match(/Resources\/.*\.png$/i)
          );

          if (!pngFile) {
            pngFile = xpsFiles.find(name => 
              name.match(/\.png$/i)
            );
          }

          if (pngFile) {
            const imageData = await xpsZip.files[pngFile].async('blob');
            return URL.createObjectURL(imageData);
          } else {
            console.warn('PNG не найден в XPS');
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

  async getPlanImageWithSize(folderId) {
    const imageUrl = await this.getPlanImage(folderId);
    if (!imageUrl) return { imageUrl: null, xpsWidth: null, xpsHeight: null };
    
    try {
      // Получаем размеры XPS
      const folderData = await this.getObject(folderId);
      if (!folderData) return { imageUrl, xpsWidth: null, xpsHeight: null };
      
      const files = folderData.actualFileSnapshot?.files || [];
      const planFile = files.find(f => f.name?.match(/\.xps$/i));
      if (!planFile) return { imageUrl, xpsWidth: null, xpsHeight: null };
      
      // Скачиваем и парсим XPS
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
}




// import JSZip from 'jszip';

// export class PanoramaService {
//   constructor(objectsRepository) {
//     this.rootId = '88dfed13-f1a0-4735-b1fc-55a71743ea5b';
//     this._objectsRepository = objectsRepository;
//   }

//   async getChildren(objectId, type = 1) {
//     try {
      
//       if (!this._objectsRepository) {
//         console.error('objectsRepository не инициализирован!');
//         return [];
//       }

//       const objects = await this._objectsRepository.getObjects([objectId]).toPromise();
//       if (!objects || objects.length === 0) {
//         console.warn(`Объект ${objectId} не найден`);
//         return [];
//       }
      
//       const obj = objects[0];
      
//       if (!obj.children || obj.children.length === 0) {
//         console.log(`Нет детей у объекта ${objectId}`);
//         return [];
//       }
      
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
//         console.error('objectsRepository не инициализирован!');
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
//       const children = await this.getChildren(this.rootId);
//       if (!children || children.length === 0) {
//         console.warn('нет доступа к корневой папке или она пуста');
//         return {};
//       }
      
//       const projects = {};
//       for (const child of children) {
//         const name = child.title || child.attributes?.name || '';
//         if (!name || name === 'Без имени' || name === '' || name === 'Source files') continue;
//         const typeName = child.type?.name || '';
//         if (typeName === 'file' || typeName === 'document') continue;
//         projects[child.id] = {
//           id: child.id,
//           name: name,
//           type: typeName,
//           _raw: child
//         };
//       }
//       return projects;
//     } catch (error) {
//       console.error('❌ Ошибка получения проектов:', error);
//       return {};
//     }
//   }

//   async getFolders(projectId) {
//     try {
//       const children = await this.getChildren(projectId);
//       if (!children || children.length === 0) {
//         console.warn(`Нет доступа к проекту ${projectId} или он пуст`);
//         return {};
//       }
      
//       const photo360 = children.find(item => 
//         item.title?.includes('Фото 360') || item.name?.includes('Фото 360')
//       );
      
//       if (!photo360) {
//         console.warn(`Папка "Фото 360" не найдена в проекте ${projectId}`);
//         return {};
//       }
      
//       const panoramaFolders = await this.getChildren(photo360.id);
//       if (!panoramaFolders || panoramaFolders.length === 0) {
//         console.warn(`Папка "Фото 360" пуста или нет доступа`);
//         return {};
//       }
      
//       const folders = {};
//       for (const folder of panoramaFolders) {
//         const folderName = folder.title || folder.name || 'Без имени';
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
//     console.log(`Поиск точек 360 в папке ${folderId}`);
//     try {
//       const children = await this.getChildren(folderId);
//       if (!children || children.length === 0) {
//         console.warn(`Нет доступа к папке ${folderId} или она пуста`);
//         return {};
//       }
      
//       console.log(`Найдено объектов: ${children.length}`);
//       const points = {};
      
//       const remarksFolder = children.find(child => 
//         child.type?.name === 'doc_remarksFolder'
//       );
      
//       if (!remarksFolder) {
//         console.warn(`Папка замечаний не найдена в ${folderId}`);
//       } else {
//         console.log(`Найдена папка замечаний: ${remarksFolder.id}`);
//         const remarksChildren = await this.getChildren(remarksFolder.id);
//         if (!remarksChildren || remarksChildren.length === 0) {
//           console.warn(`Папка замечаний пуста или нет доступа`);
//           return {};
//         }
//         await this.processPoints(remarksChildren, points);
//       }
      
//       console.log(`Найдено точек 360: ${Object.keys(points).length}`);
//       return points;
//     } catch (error) {
//       console.error(`Ошибка получения панорам из папки ${folderId}:`, error);
//       return {};
//     }
//   }

//   async processPoints(remarksChildren, points) {
//     for (const remarkChild of remarksChildren) {
//       const isPhoto360 = remarkChild.type?.name === 'doc_photo360';
//       if (isPhoto360) {
//         console.log(`Найдена точка 360: ${remarkChild.id}`);
//         const pointObj = await this.getObject(remarkChild.id);
//         if (!pointObj) {
//           console.warn(`Не удалось получить объект точки ${remarkChild.id}`);
//           continue;
//         }
//         const files = pointObj.actualFileSnapshot?.files || [];
//         if (files.length === 0) {
//           console.warn(`Нет файлов в точке ${remarkChild.id}`);
//           continue;
//         }

//         const annotation = pointObj.attributes?.annotation || '';
//         let x = null, y = null, azimuth = null, mark = null, page = null;
        
//         const xMatch = annotation.match(/<PositionX>([^<]+)<\/PositionX>/);
//         const yMatch = annotation.match(/<PositionY>([^<]+)<\/PositionY>/);
//         const azimuthMatch = annotation.match(/<Azimuth>([^<]+)<\/Azimuth>/);
//         const markMatch = annotation.match(/<Mark>([^<]+)<\/Mark>/);
//         const pageMatch = annotation.match(/<PageNumber>([^<]+)<\/PageNumber>/);
        
//         if (xMatch) x = parseFloat(xMatch[1]);
//         if (yMatch) y = parseFloat(yMatch[1]);
//         if (azimuthMatch) azimuth = parseFloat(azimuthMatch[1]);
//         if (markMatch) mark = markMatch[1];
//         if (pageMatch) page = parseInt(pageMatch[1]);
        
//         console.log(`  Координаты: X=${x}, Y=${y}, Азимут=${azimuth}, Марк=${mark}`);

//         const fileName = files[0]?.name || 'panorama.jpg';
//         points[remarkChild.id] = {
//           id: remarkChild.id,
//           name: fileName.replace(/\.[^.]+$/, '') || 'Панорама 360°',
//           url: null,
//           fileName: fileName,
//           x: x,
//           y: y,
//           azimuth: azimuth,
//           mark: mark,
//           page: page,
//           _raw: pointObj
//         };
//         console.log(`Точка загружена: ${points[remarkChild.id].name}`);
//       }
//     }
//   }

//   async loadPanoramaFile(pointId) {
//     console.log(`Загрузка файла для точки ${pointId}...`);
//     const fileUrl = await this.downloadFile(pointId);
//     return fileUrl;
//   }

//   async downloadFile(pointId) {
//     console.log(`Скачивание файла для точки ${pointId}...`);
//     try {
//       const formData = new URLSearchParams();
//       formData.append('ids', pointId);
//       formData.append('signatures', '1');
//       formData.append('printPreview', '1');
//       formData.append('annotationsFilter', '');
//       formData.append('coincidenceOfNames', '1');
      
//       const response = await fetch('/api/Files/GetFileArchive', {
//         method: 'POST',
//         headers: { 
//           'Content-Type': 'application/x-www-form-urlencoded',
//           'X-Requested-With': 'XMLHttpRequest'
//         },
//         body: formData,
//         credentials: 'include'
//       });
      
//       if (!response.ok) {
//         console.error(`HTTP ${response.status} для точки ${pointId}`);
//         return null;
//       }
      
//       const buffer = await response.arrayBuffer();
//       console.log(`Получено байт: ${buffer.byteLength}`);
//       const isZip = this.isZipArchive(buffer);
      
//       if (isZip) {
//         try {
//           const zip = await JSZip.loadAsync(buffer);
//           const files = Object.keys(zip.files);
//           console.log(`ZIP содержит: ${files.length} файлов`);
//           const imageFile = files.find(name => 
//             name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && 
//             !name.startsWith('__MACOSX/') && !name.includes('.DS_Store')
//           );
//           if (imageFile) {
//             const imageData = await zip.files[imageFile].async('blob');
//             return URL.createObjectURL(imageData);
//           } else {
//             console.warn('В ZIP нет изображений');
//             const firstFile = files.find(f => !f.startsWith('__MACOSX/') && !f.includes('.DS_Store'));
//             if (firstFile) {
//               console.log(`Берем первый файл: ${firstFile}`);
//               const fileData = await zip.files[firstFile].async('blob');
//               return URL.createObjectURL(fileData);
//             }
//           }
//         } catch (e) {
//           console.error('Ошибка распаковки ZIP:', e);
//         }
//       } else {
//         console.log('Не ZIP архив, пробуем как изображение');
//         const blob = new Blob([buffer]);
//         return URL.createObjectURL(blob);
//       }
//       return null;
//     } catch (error) {
//       console.error(`Ошибка скачивания для точки ${pointId}:`, error);
//       return null;
//     }
//   }

//   isZipArchive(buffer) {
//     try {
//       const bytes = new Uint8Array(buffer.slice(0, 4));
//       return bytes[0] === 0x50 && bytes[1] === 0x4B;
//     } catch (e) {
//       return false;
//     }
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

// // src/services/PanoramaService.js

// export class PanoramaService {
//   constructor(objectsRepository) {
//     this.rootId = '88dfed13-f1a0-4735-b1fc-55a71743ea5b';
//     this._objectsRepository = objectsRepository;
//     this.JSZip = null;
//     this.jsZipLoaded = false;
//   }

//   async loadJSZip() {
//     if (this.jsZipLoaded && this.JSZip) return this.JSZip;
//     return new Promise((resolve, reject) => {
//       if (window.JSZip) {
//         this.JSZip = window.JSZip;
//         this.jsZipLoaded = true;
//         resolve(this.JSZip);
//         return;
//       }
//       const script = document.createElement('script');
//       script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
//       script.async = true;
//       script.onload = () => {
//         if (window.JSZip) {
//           this.JSZip = window.JSZip;
//           this.jsZipLoaded = true;
//           resolve(this.JSZip);
//         } else {
//           reject(new Error('JSZip не загрузился'));
//         }
//       };
//       script.onerror = () => reject(new Error('Не удалось загрузить JSZip'));
//       document.head.appendChild(script);
//     });
//   }

//   async getChildren(objectId, type = 1) {
//     try {
      
//       if (!this._objectsRepository) {
//         console.error('objectsRepository не инициализирован!');
//         return [];
//       }

//       const objects = await this._objectsRepository.getObjects([objectId]).toPromise();
//       if (!objects || objects.length === 0) {
//         console.warn(`Объект ${objectId} не найден`);
//         return [];
//       }
      
//       const obj = objects[0];
      
//       if (!obj.children || obj.children.length === 0) {
//         console.log(`Нет детей у объекта ${objectId}`);
//         return [];
//       }
      
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
//         console.error('objectsRepository не инициализирован!');
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
//       const children = await this.getChildren(this.rootId);
//       if (!children || children.length === 0) {
//         console.warn('нет доступа к корневой папке или она пуста');
//         return {};
//       }
      
//       const projects = {};
//       for (const child of children) {
//         const name = child.title || child.attributes?.name || '';
//         if (!name || name === 'Без имени' || name === '' || name === 'Source files') continue;
//         const typeName = child.type?.name || '';
//         if (typeName === 'file' || typeName === 'document') continue;
//         projects[child.id] = {
//           id: child.id,
//           name: name,
//           type: typeName,
//           _raw: child
//         };
//       }
//       return projects;
//     } catch (error) {
//       console.error('❌ Ошибка получения проектов:', error);
//       return {};
//     }
//   }

//   async getFolders(projectId) {
//     try {
//       const children = await this.getChildren(projectId);
//       if (!children || children.length === 0) {
//         console.warn(`Нет доступа к проекту ${projectId} или он пуст`);
//         return {};
//       }
      
//       const photo360 = children.find(item => 
//         item.title?.includes('Фото 360') || item.name?.includes('Фото 360')
//       );
      
//       if (!photo360) {
//         console.warn(`Папка "Фото 360" не найдена в проекте ${projectId}`);
//         return {};
//       }
      
//       const panoramaFolders = await this.getChildren(photo360.id);
//       if (!panoramaFolders || panoramaFolders.length === 0) {
//         console.warn(`Папка "Фото 360" пуста или нет доступа`);
//         return {};
//       }
      
//       const folders = {};
//       for (const folder of panoramaFolders) {
//         const folderName = folder.title || folder.name || 'Без имени';
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
//     console.log(`Поиск точек 360 в папке ${folderId}`);
//     try {
//       const children = await this.getChildren(folderId);
//       if (!children || children.length === 0) {
//         console.warn(`Нет доступа к папке ${folderId} или она пуста`);
//         return {};
//       }
      
//       console.log(`Найдено объектов: ${children.length}`);
//       const points = {};
      
//       const remarksFolder = children.find(child => 
//         child.type?.name === 'doc_remarksFolder'
//       );
      
//       if (!remarksFolder) {
//         console.warn(`Папка замечаний не найдена в ${folderId}`);
//         // for (const child of children) {
//         //   const childName = child.title || child.name || '';
//         //   if (childName && !childName.match(/\.(jpg|jpeg|png|gif|bmp|webp|zip|rar)$/i)) {
//         //     console.log(`  📂 Проверяем подпапку: ${childName} (${child.id})`);
//         //     const subChildren = await this.getChildren(child.id);
//         //     const subRemarks = subChildren.find(sc => 
//         //       sc.type?.id === 61 || sc.type?.name === 'doc_remarksFolder'
//         //     );
//         //     if (subRemarks) {
//         //       console.log(`  📂 Найдена папка замечаний в подпапке: ${subRemarks.id}`);
//         //       const remarksChildren = await this.getChildren(subRemarks.id);
//         //       await this.processPoints(remarksChildren, points);
//         //     }
//         //   }
//         // }
//       } else {
//         console.log(`Найдена папка замечаний: ${remarksFolder.id}`);
//         const remarksChildren = await this.getChildren(remarksFolder.id);
//         if (!remarksChildren || remarksChildren.length === 0) {
//           console.warn(`Папка замечаний пуста или нет доступа`);
//           return {};
//         }
//         await this.processPoints(remarksChildren, points);
//       }
      
//       console.log(`Найдено точек 360: ${Object.keys(points).length}`);
//       return points;
//     } catch (error) {
//       console.error(`Ошибка получения панорам из папки ${folderId}:`, error);
//       return {};
//     }
//   }

//   async processPoints(remarksChildren, points) {
//     for (const remarkChild of remarksChildren) {
//       const isPhoto360 = remarkChild.type?.name === 'doc_photo360';
//       if (isPhoto360) {
//         console.log(`Найдена точка 360: ${remarkChild.id}`);
//         const pointObj = await this.getObject(remarkChild.id);
//         if (!pointObj) {
//           console.warn(`Не удалось получить объект точки ${remarkChild.id}`);
//           continue;
//         }
//         const files = pointObj.actualFileSnapshot?.files || [];
//         if (files.length === 0) {
//           console.warn(`Нет файлов в точке ${remarkChild.id}`);
//           continue;
//         }
//         // const fileUrl = await this.downloadFile(remarkChild.id);
//         // if (!fileUrl) {
//         //   console.warn(`Не удалось скачать файл для точки ${remarkChild.id}`);
//         //   continue;
//         // }
//         const fileName = files[0]?.name || 'panorama.jpg';
//         points[remarkChild.id] = {
//           id: remarkChild.id,
//           name: fileName.replace(/\.[^.]+$/, '') || 'Панорама 360°',
//           url: null,
//           fileName: fileName,
//           _raw: pointObj
//         };
//         console.log(`Точка загружена: ${points[remarkChild.id].name}`);
//       }
//     }
//   }

//   async loadPanoramaFile(pointId) {
//     console.log(`Загрузка файла для точки ${pointId}...`);
//     const fileUrl = await this.downloadFile(pointId);
//     return fileUrl;
//   }

//   async downloadFile(pointId) {
//     console.log(`Скачивание файла для точки ${pointId}...`);
//     try {
//       const formData = new URLSearchParams();
//       formData.append('ids', pointId);
//       formData.append('signatures', '1');
//       formData.append('printPreview', '1');
//       formData.append('annotationsFilter', '');
//       formData.append('coincidenceOfNames', '1');
      
//       const response = await fetch('/api/Files/GetFileArchive', {
//         method: 'POST',
//         headers: { 
//           'Content-Type': 'application/x-www-form-urlencoded',
//           'X-Requested-With': 'XMLHttpRequest'
//         },
//         body: formData,
//         credentials: 'include'
//       });
      
//       if (!response.ok) {
//         console.error(`HTTP ${response.status} для точки ${pointId}`);
//         return null;
//       }
      
//       const buffer = await response.arrayBuffer();
//       console.log(`Получено байт: ${buffer.byteLength}`);
//       const isZip = this.isZipArchive(buffer);
      
//       if (isZip) {
//         try {
//           const JSZip = await this.loadJSZip();
//           const zip = await JSZip.loadAsync(buffer);
//           const files = Object.keys(zip.files);
//           console.log(`ZIP содержит: ${files.length} файлов`);
//           const imageFile = files.find(name => 
//             name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && 
//             !name.startsWith('__MACOSX/') && !name.includes('.DS_Store')
//           );
//           if (imageFile) {
//             const imageData = await zip.files[imageFile].async('blob');
//             return URL.createObjectURL(imageData);
//           } else {
//             console.warn('В ZIP нет изображений');
//             const firstFile = files.find(f => !f.startsWith('__MACOSX/') && !f.includes('.DS_Store'));
//             if (firstFile) {
//               console.log(`Берем первый файл: ${firstFile}`);
//               const fileData = await zip.files[firstFile].async('blob');
//               return URL.createObjectURL(fileData);
//             }
//           }
//         } catch (e) {
//           console.error('Ошибка распаковки ZIP:', e);
//         }
//       } else {
//         console.log('Не ZIP архив, пробуем как изображение');
//         const blob = new Blob([buffer]);
//         return URL.createObjectURL(blob);
//       }
//       return null;
//     } catch (error) {
//       console.error(`Ошибка скачивания для точки ${pointId}:`, error);
//       return null;
//     }
//   }

//   isZipArchive(buffer) {
//     try {
//       const bytes = new Uint8Array(buffer.slice(0, 4));
//       return bytes[0] === 0x50 && bytes[1] === 0x4B;
//     } catch (e) {
//       return false;
//     }
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




// export class PanoramaService {
//   constructor(objectsRepository) {
//     this.rootId = '88dfed13-f1a0-4735-b1fc-55a71743ea5b';
//     this._objectsRepository = objectsRepository;
//     this.JSZip = null;
//     this.jsZipLoaded = false;
//   }

//   async loadJSZip() {
//     if (this.jsZipLoaded && this.JSZip) return this.JSZip;
//     return new Promise((resolve, reject) => {
//       if (window.JSZip) {
//         this.JSZip = window.JSZip;
//         this.jsZipLoaded = true;
//         resolve(this.JSZip);
//         return;
//       }
//       const script = document.createElement('script');
//       script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
//       script.async = true;
//       script.onload = () => {
//         if (window.JSZip) {
//           this.JSZip = window.JSZip;
//           this.jsZipLoaded = true;
//           resolve(this.JSZip);
//         } else {
//           reject(new Error('JSZip не загрузился'));
//         }
//       };
//       script.onerror = () => reject(new Error('Не удалось загрузить JSZip'));
//       document.head.appendChild(script);
//     });
//   }

//   async getChildren(objectId, type = 1) {
//     try {
      
//       if (!this._objectsRepository) {
//         console.error('objectsRepository не инициализирован!');
//         return [];
//       }

//       const objects = await this._objectsRepository.getObjects([objectId]).toPromise();
//       if (!objects || objects.length === 0) {
//         console.warn(`Объект ${objectId} не найден`);
//         return [];
//       }
      
//       const obj = objects[0];
      
//       if (!obj.children || obj.children.length === 0) {
//         console.log(`Нет детей у объекта ${objectId}`);
//         return [];
//       }
      
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
//         console.error('objectsRepository не инициализирован!');
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
//       const children = await this.getChildren(this.rootId);
//       if (!children || children.length === 0) {
//         console.warn('нет доступа к корневой папке или она пуста');
//         return {};
//       }
      
//       const projects = {};
//       for (const child of children) {
//         const name = child.title || child.attributes?.name || '';
//         if (!name || name === 'Без имени' || name === '' || name === 'Source files') continue;
//         const typeName = child.type?.name || '';
//         if (typeName === 'file' || typeName === 'document') continue;
//         projects[child.id] = {
//           id: child.id,
//           name: name,
//           type: typeName,
//           _raw: child
//         };
//       }
//       return projects;
//     } catch (error) {
//       console.error('❌ Ошибка получения проектов:', error);
//       return {};
//     }
//   }

//   async getFolders(projectId) {
//     try {
//       const children = await this.getChildren(projectId);
//       if (!children || children.length === 0) {
//         console.warn(`Нет доступа к проекту ${projectId} или он пуст`);
//         return {};
//       }
      
//       const photo360 = children.find(item => 
//         item.title?.includes('Фото 360') || item.name?.includes('Фото 360')
//       );
      
//       if (!photo360) {
//         console.warn(`Папка "Фото 360" не найдена в проекте ${projectId}`);
//         return {};
//       }
      
//       const panoramaFolders = await this.getChildren(photo360.id);
//       if (!panoramaFolders || panoramaFolders.length === 0) {
//         console.warn(`Папка "Фото 360" пуста или нет доступа`);
//         return {};
//       }
      
//       const folders = {};
//       for (const folder of panoramaFolders) {
//         const folderName = folder.title || folder.name || 'Без имени';
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
//   console.log(`Поиск точек 360 в папке ${folderId}`);
//   try {
//     const children = await this.getChildren(folderId);
//     if (!children || children.length === 0) {
//       console.warn(`Нет доступа к папке ${folderId} или она пуста`);
//       return {};
//     }
    
//     console.log(`Найдено объектов: ${children.length}`);
//     const points = {};
    
//     const remarksFolder = children.find(child => 
//       child.type?.name === 'doc_remarksFolder'
//     );
    
//     if (!remarksFolder) {
//       console.warn(`Папка замечаний не найдена в ${folderId}`);
//       return {};
//     }
    
//     console.log(`Найдена папка замечаний: ${remarksFolder.id}`);
//     const remarksChildren = await this.getChildren(remarksFolder.id);
//     if (!remarksChildren || remarksChildren.length === 0) {
//       console.warn(`Папка замечаний пуста или нет доступа`);
//       return {};
//     }
    
//     // ===== ИЗМЕНЕНО: передаем точки в processPoints =====
//     await this.processPoints(remarksChildren, points);
    
//     console.log(`Найдено точек 360: ${Object.keys(points).length}`);
//     return points;
//   } catch (error) {
//     console.error(`Ошибка получения панорам из папки ${folderId}:`, error);
//     return {};
//   }
// }

//   async processPoints(remarksChildren, points) {
//   for (const remarkChild of remarksChildren) {
//     const isPhoto360 = remarkChild.type?.name === 'doc_photo360';
//     if (isPhoto360) {
//       console.log(`Найдена точка 360: ${remarkChild.id}`);
//       const pointObj = await this.getObject(remarkChild.id);
//       if (!pointObj) {
//         console.warn(`Не удалось получить объект точки ${remarkChild.id}`);
//         continue;
//       }
//       const files = pointObj.actualFileSnapshot?.files || [];
//       if (files.length === 0) {
//         console.warn(`Нет файлов в точке ${remarkChild.id}`);
//         continue;
//       }

//       // ===== НОВОЕ: Парсим координаты из аннотации =====
//       const annotation = pointObj.attributes?.annotation || '';
//       let x = null, y = null, azimuth = null, mark = null, page = null;
      
//       const xMatch = annotation.match(/<PositionX>([^<]+)<\/PositionX>/);
//       const yMatch = annotation.match(/<PositionY>([^<]+)<\/PositionY>/);
//       const azimuthMatch = annotation.match(/<Azimuth>([^<]+)<\/Azimuth>/);
//       const markMatch = annotation.match(/<Mark>([^<]+)<\/Mark>/);
//       const pageMatch = annotation.match(/<PageNumber>([^<]+)<\/PageNumber>/);
      
//       if (xMatch) x = parseFloat(xMatch[1]);
//       if (yMatch) y = parseFloat(yMatch[1]);
//       if (azimuthMatch) azimuth = parseFloat(azimuthMatch[1]);
//       if (markMatch) mark = markMatch[1];
//       if (pageMatch) page = parseInt(pageMatch[1]);
      
//       console.log(`  Координаты: X=${x}, Y=${y}, Азимут=${azimuth}, Марк=${mark}`);

//       const fileName = files[0]?.name || 'panorama.jpg';
//       points[remarkChild.id] = {
//         id: remarkChild.id,
//         name: fileName.replace(/\.[^.]+$/, '') || 'Панорама 360°',
//         url: null,
//         fileName: fileName,
//         // ===== НОВОЕ: добавляем координаты в объект точки =====
//         x: x,
//         y: y,
//         azimuth: azimuth,
//         mark: mark,
//         page: page,
//         _raw: pointObj
//       };
//       console.log(`Точка загружена: ${points[remarkChild.id].name}`);
//     }
//   }
// }


//   async loadPanoramaFile(pointId) {
//     console.log(`Загрузка файла для точки ${pointId}...`);
//     const fileUrl = await this.downloadFile(pointId);
//     return fileUrl;
//   }

//   async downloadFile(pointId) {
//     console.log(`Скачивание файла для точки ${pointId}...`);
//     try {
//       const formData = new URLSearchParams();
//       formData.append('ids', pointId);
//       formData.append('signatures', '1');
//       formData.append('printPreview', '1');
//       formData.append('annotationsFilter', '');
//       formData.append('coincidenceOfNames', '1');
      
//       const response = await fetch('/api/Files/GetFileArchive', {
//         method: 'POST',
//         headers: { 
//           'Content-Type': 'application/x-www-form-urlencoded',
//           'X-Requested-With': 'XMLHttpRequest'
//         },
//         body: formData,
//         credentials: 'include'
//       });
      
//       if (!response.ok) {
//         console.error(`HTTP ${response.status} для точки ${pointId}`);
//         return null;
//       }
      
//       const buffer = await response.arrayBuffer();
//       console.log(`Получено байт: ${buffer.byteLength}`);
//       const isZip = this.isZipArchive(buffer);
      
//       if (isZip) {
//         try {
//           const JSZip = await this.loadJSZip();
//           const zip = await JSZip.loadAsync(buffer);
//           const files = Object.keys(zip.files);
//           const imageFile = files.find(name => 
//             name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && 
//             !name.startsWith('__MACOSX/') && !name.includes('.DS_Store')
//           );
//           if (imageFile) {
//             const imageData = await zip.files[imageFile].async('blob');
//             return URL.createObjectURL(imageData);
//           } else {
//             console.warn('В ZIP нет изображений');
//             const firstFile = files.find(f => !f.startsWith('__MACOSX/') && !f.includes('.DS_Store'));
//             if (firstFile) {
//               console.log(`Берем первый файл: ${firstFile}`);
//               const fileData = await zip.files[firstFile].async('blob');
//               return URL.createObjectURL(fileData);
//             }
//           }
//         } catch (e) {
//           console.error('Ошибка распаковки ZIP:', e);
//         }
//       } else {
//         console.log('Не ZIP архив, пробуем как изображение');
//         const blob = new Blob([buffer]);
//         return URL.createObjectURL(blob);
//       }
//       return null;
//     } catch (error) {
//       console.error(`Ошибка скачивания для точки ${pointId}:`, error);
//       return null;
//     }
//   }

//   isZipArchive(buffer) {
//     try {
//       const bytes = new Uint8Array(buffer.slice(0, 4));
//       return bytes[0] === 0x50 && bytes[1] === 0x4B;
//     } catch (e) {
//       return false;
//     }
//   }

//   clearUrls(points) {
//     if (!points) return;
//     for (const point of Object.values(points)) {
//       if (point.url && point.url.startsWith('blob:')) {
//         URL.revokeObjectURL(point.url);
//       }
//     }
//   }

//   // PanoramaService.js

// // ===== НОВОЕ: функция для получения и парсинга плана здания через IObjectsRepository =====
// // PanoramaService.js

// async getPlanImage(folderId) {
//   console.log(`📥 Получение плана для папки ${folderId}...`);
  
//   try {
//     const folderData = await this.getObject(folderId);
//     if (!folderData) {
//       console.warn('❌ Папка не найдена');
//       return null;
//     }

//     const files = folderData.actualFileSnapshot?.files || [];
//     const planFile = files.find(f => 
//       f.name?.match(/\.(xps|pdf)$/i)
//     );

//     if (!planFile) {
//       console.warn('❌ Файл плана (XPS/PDF) не найден');
//       console.log('Доступные файлы:', files.map(f => f.name));
//       return null;
//     }

//     const fileName = planFile.name;
//     console.log(`📄 Найден файл: ${fileName}`);

//     // Скачиваем архив
//     const formData = new URLSearchParams();
//     formData.append('ids', folderId);
//     formData.append('signatures', '1');
//     formData.append('printPreview', '1');
//     formData.append('annotationsFilter', '');
//     formData.append('coincidenceOfNames', '1');
    
//     const response = await fetch('/api/Files/GetFileArchive', {
//       method: 'POST',
//       headers: { 
//         'Content-Type': 'application/x-www-form-urlencoded',
//         'X-Requested-With': 'XMLHttpRequest'
//       },
//       body: formData,
//       credentials: 'include'
//     });

//     if (!response.ok) {
//       console.error(`❌ HTTP ${response.status}`);
//       return null;
//     }

//     const buffer = await response.arrayBuffer();
//     console.log(`📦 Получено байт: ${buffer.byteLength}`);

//     // Распаковываем архив
//     const JSZip = await this.loadJSZip();
//     const zip = await JSZip.loadAsync(buffer);
//     const filesList = Object.keys(zip.files);
//     console.log(`📦 Архив содержит ${filesList.length} файлов`);

//     // Ищем XPS или PDF в архиве
//     const innerFile = filesList.find(name => 
//       name.match(/\.(xps|pdf)$/i)
//     );

//     if (!innerFile) {
//       console.warn('❌ Внутри архива нет XPS/PDF');
//       console.log('Доступные файлы:', filesList);
//       return null;
//     }

//     console.log(`📄 Внутри архива: ${innerFile}`);
//     const innerBuffer = await zip.files[innerFile].async('arraybuffer');
//     console.log(`📦 Внутренний файл: ${innerBuffer.byteLength} байт`);

//     // Если это PDF — рендерим в PNG
//     if (innerFile.match(/\.pdf$/i)) {
//       console.log('📄 Это PDF, рендерим в PNG...');
//       return await this.renderPdfToImage(innerBuffer);
//     }

//     // Если это XPS — распаковываем как ZIP и ищем PNG
//     if (innerFile.match(/\.xps$/i)) {
//       console.log('📄 Это XPS, распаковываем как ZIP');
      
//       const isZip = this.isZipArchive(innerBuffer);
//       if (!isZip) {
//         console.warn('⚠️ XPS файл не является ZIP архивом');
//         const blob = new Blob([innerBuffer]);
//         return URL.createObjectURL(blob);
//       }

//       try {
//         const xpsZip = await JSZip.loadAsync(innerBuffer);
//         const xpsFiles = Object.keys(xpsZip.files);
//         console.log(`📦 XPS содержит ${xpsFiles.length} файлов`);

//         let pngFile = xpsFiles.find(name => 
//           name.match(/Resources\/.*\.png$/i)
//         );

//         if (!pngFile) {
//           pngFile = xpsFiles.find(name => 
//             name.match(/\.png$/i)
//           );
//         }

//         if (pngFile) {
//           console.log(`🖼️ Найден PNG: ${pngFile}`);
//           const imageData = await xpsZip.files[pngFile].async('blob');
//           return URL.createObjectURL(imageData);
//         } else {
//           console.warn('⚠️ PNG не найден в XPS');
//           console.log('Доступные файлы в XPS:', xpsFiles);
//           return null;
//         }
//       } catch (e) {
//         console.error('❌ Ошибка распаковки XPS:', e);
//         return null;
//       }
//     }

//     const blob = new Blob([innerBuffer]);
//     return URL.createObjectURL(blob);
//   } catch (error) {
//     console.error('❌ Ошибка получения плана:', error);
//     return null;
//   }
// }

// // ===== НОВОЕ: рендеринг PDF в PNG через pdf.js =====
// async renderPdfToImage(pdfBuffer) {
//   try {
//     // Загружаем pdf.js если еще не загружен
//     if (!window.pdfjsLib) {
//       await this.loadPdfJs();
//     }

//     const pdf = await window.pdfjsLib.getDocument({ data: pdfBuffer }).promise;
//     const page = await pdf.getPage(1); // Берем первую страницу
    
//     const scale = 2; // Увеличиваем качество
//     const viewport = page.getViewport({ scale: scale });
    
//     const canvas = document.createElement('canvas');
//     const context = canvas.getContext('2d');
//     canvas.width = viewport.width;
//     canvas.height = viewport.height;
    
//     const renderContext = {
//       canvasContext: context,
//       viewport: viewport
//     };
    
//     await page.render(renderContext).promise;
    
//     return canvas.toDataURL('image/png');
//   } catch (error) {
//     console.error('❌ Ошибка рендеринга PDF:', error);
//     return null;
//   }
// }

// // ===== НОВОЕ: загрузка pdf.js =====
// async loadPdfJs() {
//   return new Promise((resolve, reject) => {
//     if (window.pdfjsLib) {
//       resolve(window.pdfjsLib);
//       return;
//     }

//     // Загружаем pdf.js из CDN
//     const script = document.createElement('script');
//     script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
//     script.async = true;
//     script.onload = () => {
//       // Устанавливаем worker
//       window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
//       resolve(window.pdfjsLib);
//     };
//     script.onerror = () => {
//       reject(new Error('Не удалось загрузить pdf.js'));
//     };
//     document.head.appendChild(script);
//   });
// }
// }