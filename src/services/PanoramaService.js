// src/services/PanoramaService.js

export class PanoramaService {
  constructor(objectsRepository) {
    this.rootId = '88dfed13-f1a0-4735-b1fc-55a71743ea5b';
    this._objectsRepository = objectsRepository;
    this.JSZip = null;
    this.jsZipLoaded = false;
  }

  async loadJSZip() {
    if (this.jsZipLoaded && this.JSZip) return this.JSZip;
    return new Promise((resolve, reject) => {
      if (window.JSZip) {
        this.JSZip = window.JSZip;
        this.jsZipLoaded = true;
        resolve(this.JSZip);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.async = true;
      script.onload = () => {
        if (window.JSZip) {
          this.JSZip = window.JSZip;
          this.jsZipLoaded = true;
          resolve(this.JSZip);
        } else {
          reject(new Error('JSZip не загрузился'));
        }
      };
      script.onerror = () => reject(new Error('Не удалось загрузить JSZip'));
      document.head.appendChild(script);
    });
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
        console.log(`Нет детей у объекта ${objectId}`);
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

  async getProjects() {
    try {
      const children = await this.getChildren(this.rootId);
      if (!children || children.length === 0) {
        console.warn('нет доступа к корневой папке или она пуста');
        return {};
      }
      
      const projects = {};
      for (const child of children) {
        const name = child.title || child.attributes?.name || '';
        if (!name || name === 'Без имени' || name === '' || name === 'Source files') continue;
        const typeName = child.type?.name || '';
        if (typeName === 'file' || typeName === 'document') continue;
        projects[child.id] = {
          id: child.id,
          name: name,
          type: typeName,
          _raw: child
        };
      }
      return projects;
    } catch (error) {
      console.error('❌ Ошибка получения проектов:', error);
      return {};
    }
  }

  async getFolders(projectId) {
    try {
      const children = await this.getChildren(projectId);
      if (!children || children.length === 0) {
        console.warn(`Нет доступа к проекту ${projectId} или он пуст`);
        return {};
      }
      
      const photo360 = children.find(item => 
        item.title?.includes('Фото 360') || item.name?.includes('Фото 360')
      );
      
      if (!photo360) {
        console.warn(`Папка "Фото 360" не найдена в проекте ${projectId}`);
        return {};
      }
      
      const panoramaFolders = await this.getChildren(photo360.id);
      if (!panoramaFolders || panoramaFolders.length === 0) {
        console.warn(`Папка "Фото 360" пуста или нет доступа`);
        return {};
      }
      
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

  async getPanorams(folderId) {
    console.log(`Поиск точек 360 в папке ${folderId}`);
    try {
      const children = await this.getChildren(folderId);
      if (!children || children.length === 0) {
        console.warn(`Нет доступа к папке ${folderId} или она пуста`);
        return {};
      }
      
      console.log(`Найдено объектов: ${children.length}`);
      const points = {};
      
      const remarksFolder = children.find(child => 
        child.type?.name === 'doc_remarksFolder'
      );
      
      if (!remarksFolder) {
        console.warn(`Папка замечаний не найдена в ${folderId}`);
        // for (const child of children) {
        //   const childName = child.title || child.name || '';
        //   if (childName && !childName.match(/\.(jpg|jpeg|png|gif|bmp|webp|zip|rar)$/i)) {
        //     console.log(`  📂 Проверяем подпапку: ${childName} (${child.id})`);
        //     const subChildren = await this.getChildren(child.id);
        //     const subRemarks = subChildren.find(sc => 
        //       sc.type?.id === 61 || sc.type?.name === 'doc_remarksFolder'
        //     );
        //     if (subRemarks) {
        //       console.log(`  📂 Найдена папка замечаний в подпапке: ${subRemarks.id}`);
        //       const remarksChildren = await this.getChildren(subRemarks.id);
        //       await this.processPoints(remarksChildren, points);
        //     }
        //   }
        // }
      } else {
        console.log(`Найдена папка замечаний: ${remarksFolder.id}`);
        const remarksChildren = await this.getChildren(remarksFolder.id);
        if (!remarksChildren || remarksChildren.length === 0) {
          console.warn(`Папка замечаний пуста или нет доступа`);
          return {};
        }
        await this.processPoints(remarksChildren, points);
      }
      
      console.log(`Найдено точек 360: ${Object.keys(points).length}`);
      return points;
    } catch (error) {
      console.error(`Ошибка получения панорам из папки ${folderId}:`, error);
      return {};
    }
  }

  async processPoints(remarksChildren, points) {
    for (const remarkChild of remarksChildren) {
      const isPhoto360 = remarkChild.type?.name === 'doc_photo360';
      if (isPhoto360) {
        console.log(`Найдена точка 360: ${remarkChild.id}`);
        const pointObj = await this.getObject(remarkChild.id);
        if (!pointObj) {
          console.warn(`Не удалось получить объект точки ${remarkChild.id}`);
          continue;
        }
        const files = pointObj.actualFileSnapshot?.files || [];
        if (files.length === 0) {
          console.warn(`Нет файлов в точке ${remarkChild.id}`);
          continue;
        }
        // const fileUrl = await this.downloadFile(remarkChild.id);
        // if (!fileUrl) {
        //   console.warn(`Не удалось скачать файл для точки ${remarkChild.id}`);
        //   continue;
        // }
        const fileName = files[0]?.name || 'panorama.jpg';
        points[remarkChild.id] = {
          id: remarkChild.id,
          name: fileName.replace(/\.[^.]+$/, '') || 'Панорама 360°',
          url: null,
          fileName: fileName,
          _raw: pointObj
        };
        console.log(`Точка загружена: ${points[remarkChild.id].name}`);
      }
    }
  }

  async loadPanoramaFile(pointId) {
    console.log(`Загрузка файла для точки ${pointId}...`);
    const fileUrl = await this.downloadFile(pointId);
    return fileUrl;
  }

  async downloadFile(pointId) {
    console.log(`Скачивание файла для точки ${pointId}...`);
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
      console.log(`Получено байт: ${buffer.byteLength}`);
      const isZip = this.isZipArchive(buffer);
      
      if (isZip) {
        try {
          const JSZip = await this.loadJSZip();
          const zip = await JSZip.loadAsync(buffer);
          const files = Object.keys(zip.files);
          console.log(`ZIP содержит: ${files.length} файлов`);
          const imageFile = files.find(name => 
            name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && 
            !name.startsWith('__MACOSX/') && !name.includes('.DS_Store')
          );
          if (imageFile) {
            const imageData = await zip.files[imageFile].async('blob');
            return URL.createObjectURL(imageData);
          } else {
            console.warn('В ZIP нет изображений');
            const firstFile = files.find(f => !f.startsWith('__MACOSX/') && !f.includes('.DS_Store'));
            if (firstFile) {
              console.log(`Берем первый файл: ${firstFile}`);
              const fileData = await zip.files[firstFile].async('blob');
              return URL.createObjectURL(fileData);
            }
          }
        } catch (e) {
          console.error('Ошибка распаковки ZIP:', e);
        }
      } else {
        console.log('Не ZIP архив, пробуем как изображение');
        const blob = new Blob([buffer]);
        return URL.createObjectURL(blob);
      }
      return null;
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
}



// // src/services/panoramaService.js
// import JSZip from 'jszip';

// export class PanoramaService {
//   constructor() {
//     this.rootId = '88dfed13-f1a0-4735-b1fc-55a71743ea5b';
//   }

//   async getChildren(id, type = 1) {
//     try {
//       const response = await fetch(
//         `/api/Documents/GetDocumentChildren?id=${id}&childrenType=${type}`,
//         {
//           method: 'GET',
//           credentials: 'include',
//           headers: { 'Accept': 'application/json' }
//         }
//       );
      
//       if (!response.ok) throw new Error(`HTTP ${response.status}`);
//       return await response.json();
//     } catch (error) {
//       console.error(`❌ Ошибка получения детей для ${id}:`, error);
//       return [];
//     }
//   }

//   async getObject(id) {
//     try {
//       const response = await fetch(
//         `/api/Documents/GetObject?id=${id}`,
//         {
//           method: 'GET',
//           credentials: 'include',
//           headers: { 'Accept': 'application/json' }
//         }
//       );
      
//       if (!response.ok) throw new Error(`HTTP ${response.status}`);
//       return await response.json();
//     } catch (error) {
//       console.error(`❌ Ошибка получения объекта ${id}:`, error);
//       return null;
//     }
//   }

//   async getProjects() {
    
//     try {
//       const children = await this.getChildren(this.rootId, 1);
      
//       const projects = {};
      
//       for (const child of children) {
//         const objectId = child.objectId || child.id;
//         if (!objectId) continue;
        
//         const obj = await this.getObject(objectId);
//         if (!obj) continue;
        
//         const name = obj.title || obj.attributes?.name || obj.name || null;
//         if (!name || name === 'Без имени' || name === '' || name === 'Source files') continue;
        
//         const typeName = obj.type?.name || '';
//         if (typeName === 'file' || typeName === 'document') continue;
        
//         projects[objectId] = {
//           id: objectId,
//           name: name,
//           type: typeName,
//           _raw: obj
//         };
//       }
      
//       return projects;
      
//     } catch (error) {
//       console.error('Ошибка получения проектов:', error);
//       return {};
//     }
//   }

//   async getFolders(projectId) {
    
//     try {
//       const children = await this.getChildren(projectId, 1);
      
//       const photo360 = children.find(item => 
//         item.title === 'Фото 360' || 
//         item.title?.includes('Фото 360') ||
//         item.name === 'Фото 360'
//       );
      
//       if (!photo360) {
//         console.warn(`Папка "Фото 360" не найдена в проекте ${projectId}`);
//         return {};
//       }
      
//       const photo360Id = photo360.objectId || photo360.id;
      
//       const panoramaFolders = await this.getChildren(photo360Id, 1);
      
//       const folders = {};
//       for (const folder of panoramaFolders) {
//         const folderId = folder.objectId || folder.id;
//         const folderName = folder.title || folder.name || 'Без имени';
        
//         folders[folderId] = {
//           id: folderId,
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

//   //  async getPanorams(folderId) {
    
//   //   try {
//   //     let children = await this.getChildren(folderId, 1);
      
//   //     let remarksFolderId = null;
//   //     let points = {};
      
//   //     for (const child of children) {
//   //       if (child.type.name === 'doc_remarksFolder') {
//   //         remarksFolderId = child.objectId || child.id;
//   //         console.log(`  📂 Найдена папка замечаний: ${remarksFolderId}`);

//   //         let remarks_children = await this.getChildren(remarksFolderId, 1);
          
//   //         for (const remarks_child of remarks_children) {
//   //           let pointId = remarks_child.objectId || remarks_child.id;
//   //           let point = remarks_child;

//   //           if (point.type.name === 'doc_photo360') {
//   //             points[pointId] = {
//   //               id: pointId,
//   //               _raw: point
//   //             };
//   //           }
//   //         }

//   //         break;
//   //       }
//   //     }  
//   //   } catch (error) {
//   //     console.error(`❌ Ошибка получения панорам из папки ${folderId}:`, error);
//   //     return {};
//   //   }
//   // }

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
//   //       console.error(`❌ HTTP ${response.status} для точки ${pointId}`);
//   //       return null;
//   //     }
      
//   //     const buffer = await response.arrayBuffer();
//   //     console.log(`📦 Получено байт: ${buffer.byteLength}`);
      
//   //     try {
//   //       const zip = await JSZip.loadAsync(buffer);
//   //       const files = Object.keys(zip.files);
//   //       console.log(`  📦 ZIP содержит: ${files.length} файлов`);
        
//   //       const imageFile = files.find(name => 
//   //         name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)
//   //       );
        
//   //       if (imageFile) {
//   //         console.log(`  🖼️ Найдено изображение: ${imageFile}`);
//   //         const imageData = await zip.files[imageFile].async('blob');
//   //         return URL.createObjectURL(imageData);
//   //       }
//   //     } catch (e) {
//   //       console.log('  📄 Не ZIP архив, пробуем как есть');
//   //       const blob = new Blob([buffer]);
//   //       return URL.createObjectURL(blob);
//   //     }
      
//   //     return null;
//   //   } catch (error) {
//   //     console.error(`❌ Ошибка скачивания для точки ${pointId}:`, error);
//   //     return null;
//   //   }
//   // }

//   // src/services/panoramaService.js
// import JSZip from 'jszip';

// export class PanoramaService {
//   constructor() {
//     this.rootId = '88dfed13-f1a0-4735-b1fc-55a71743ea5b';
//   }

//   async getChildren(id, type = 1) {
//     try {
//       const response = await fetch(
//         `/api/Documents/GetDocumentChildren?id=${id}&childrenType=${type}`,
//         {
//           method: 'GET',
//           credentials: 'include',
//           headers: { 'Accept': 'application/json' }
//         }
//       );
      
//       if (!response.ok) throw new Error(`HTTP ${response.status}`);
//       return await response.json();
//     } catch (error) {
//       console.error(`❌ Ошибка получения детей для ${id}:`, error);
//       return [];
//     }
//   }

//   async getObject(id) {
//     try {
//       const response = await fetch(
//         `/api/Documents/GetObject?id=${id}`,
//         {
//           method: 'GET',
//           credentials: 'include',
//           headers: { 'Accept': 'application/json' }
//         }
//       );
      
//       if (!response.ok) throw new Error(`HTTP ${response.status}`);
//       return await response.json();
//     } catch (error) {
//       console.error(`❌ Ошибка получения объекта ${id}:`, error);
//       return null;
//     }
//   }

//   async getProjects() {
//     try {
//       const children = await this.getChildren(this.rootId, 1);
//       const projects = {};
      
//       for (const child of children) {
//         const objectId = child.objectId || child.id;
//         if (!objectId) continue;
        
//         const obj = await this.getObject(objectId);
//         if (!obj) continue;
        
//         const name = obj.title || obj.attributes?.name || obj.name || null;
//         if (!name || name === 'Без имени' || name === '' || name === 'Source files') continue;
        
//         const typeName = obj.type?.name || '';
//         if (typeName === 'file' || typeName === 'document') continue;
        
//         projects[objectId] = {
//           id: objectId,
//           name: name,
//           type: typeName,
//           _raw: obj
//         };
//       }
      
//       return projects;
//     } catch (error) {
//       console.error('Ошибка получения проектов:', error);
//       return {};
//     }
//   }

//   async getFolders(projectId) {
//     try {
//       const children = await this.getChildren(projectId, 1);
      
//       const photo360 = children.find(item => 
//         item.title === 'Фото 360' || 
//         item.title?.includes('Фото 360') ||
//         item.name === 'Фото 360'
//       );
      
//       if (!photo360) {
//         console.warn(`Папка "Фото 360" не найдена в проекте ${projectId}`);
//         return {};
//       }
      
//       const photo360Id = photo360.objectId || photo360.id;
//       const panoramaFolders = await this.getChildren(photo360Id, 1);
      
//       const folders = {};
//       for (const folder of panoramaFolders) {
//         const folderId = folder.objectId || folder.id;
//         const folderName = folder.title || folder.name || 'Без имени';
        
//         folders[folderId] = {
//           id: folderId,
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

//   // ===== ПОЛУЧИТЬ ПАНОРАМЫ (ИСПРАВЛЕН) =====
//   async getPanorams(folderId) {
//     console.log(`📥 Поиск точек 360 в папке ${folderId}...`);
    
//     try {
//       const children = await this.getChildren(folderId, 1);
//       console.log(`  Найдено объектов: ${children.length}`);
      
//       const points = {};
      
//       for (const child of children) {
//         // Проверяем, является ли объект папкой замечаний
//         const isRemarksFolder = child.typeId === 61 || child.type?.name === 'doc_remarksFolder';
        
//         if (isRemarksFolder) {
//           const remarksFolderId = child.objectId || child.id;
//           console.log(`  📂 Найдена папка замечаний: ${remarksFolderId}`);
          
//           // Получаем детей папки замечаний (точки 360)
//           const remarksChildren = await this.getChildren(remarksFolderId, 1);
//           console.log(`    Найдено объектов в папке замечаний: ${remarksChildren.length}`);
          
//           // Проходим по точкам в папке замечаний
//           for (const remarkChild of remarksChildren) {
//             const pointId = remarkChild.objectId || remarkChild.id;
            
//             // Проверяем, является ли объект точкой 360
//             const isPhoto360 = remarkChild.typeId === 62 || remarkChild.type?.name === 'doc_photo360';
            
//             if (isPhoto360) {
//               console.log(`  🎯 Найдена точка 360: ${pointId}`);
              
//               // Получаем полный объект точки
//               const pointObj = await this.getObject(pointId);
//               if (!pointObj) {
//                 console.warn(`  ⚠️ Не удалось получить объект точки ${pointId}`);
//                 continue;
//               }
              
//               // Проверяем наличие файлов
//               const files = pointObj.actualFileSnapshot?.files || [];
//               if (files.length === 0) {
//                 console.warn(`  ⚠️ Нет файлов в точке ${pointId}`);
//                 continue;
//               }
              
//               // Скачиваем файл (используем ID точки)
//               const fileUrl = await this.downloadFile(pointId);
//               if (!fileUrl) {
//                 console.warn(`  ⚠️ Не удалось скачать файл для точки ${pointId}`);
//                 continue;
//               }
              
//               // Сохраняем точку с URL изображения
//               const fileName = files[0]?.name || 'panorama.jpg';
//               points[pointId] = {
//                 id: pointId,
//                 name: fileName.replace(/\.[^.]+$/, '') || 'Панорама 360°',
//                 url: fileUrl,
//                 fileName: fileName,
//                 _raw: pointObj
//               };
              
//               console.log(`  ✅ Точка загружена: ${points[pointId].name}`);
//             }
//           }
          
//           // Выходим после первой найденной папки замечаний
//           break;
//         }
//       }
      
//       console.log(`✅ Найдено точек 360: ${Object.keys(points).length}`);
//       return points;
      
//     } catch (error) {
//       console.error(`❌ Ошибка получения панорам из папки ${folderId}:`, error);
//       return {};
//     }
//   }

//   // ===== СКАЧАТЬ ФАЙЛ ПО ID ТОЧКИ =====
//   async downloadFile(pointId) {
//     console.log(`📥 Скачивание файла для точки ${pointId}...`);
    
//     try {
//       const formData = new URLSearchParams();
//       formData.append('ids', pointId);
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
//         console.error(`❌ HTTP ${response.status} для точки ${pointId}`);
//         return null;
//       }
      
//       const buffer = await response.arrayBuffer();
//       console.log(`📦 Получено байт: ${buffer.byteLength}`);
      
//       // Пробуем распаковать ZIP
//       try {
//         const zip = await JSZip.loadAsync(buffer);
//         const files = Object.keys(zip.files);
//         console.log(`  📦 ZIP содержит: ${files.length} файлов`);
        
//         // Ищем изображение
//         const imageFile = files.find(name => 
//           name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && 
//           !name.startsWith('__MACOSX/') &&
//           !name.includes('.DS_Store')
//         );
        
//         if (imageFile) {
//           console.log(`  🖼️ Найдено изображение: ${imageFile}`);
//           const imageData = await zip.files[imageFile].async('blob');
//           return URL.createObjectURL(imageData);
//         } else {
//           console.warn('  ⚠️ В ZIP нет изображений');
//         }
//       } catch (e) {
//         // Если не ZIP, пробуем как есть
//         console.log('  📄 Не ZIP архив, пробуем как изображение');
//         const blob = new Blob([buffer]);
//         return URL.createObjectURL(blob);
//       }
      
//       return null;
//     } catch (error) {
//       console.error(`❌ Ошибка скачивания для точки ${pointId}:`, error);
//       return null;
//     }
//   }

//   // ===== ОЧИСТКА URL =====
//   clearUrls(points) {
//     if (!points) return;
//     for (const point of Object.values(points)) {
//       if (point.url && point.url.startsWith('blob:')) {
//         URL.revokeObjectURL(point.url);
//       }
//     }
//   }
// }

//   async _extractPhotosFromZip(fileId, fileName) {
//     console.log(`  📦 Распаковка ${fileName}...`);
//     const photos = {};
    
//     try {
//       const formData = new URLSearchParams();
//       formData.append('ids', fileId);
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
      
//       if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
//       const buffer = await response.arrayBuffer();
//       const zip = await JSZip.loadAsync(buffer);
//       const files = Object.keys(zip.files);
      
//       console.log(`    📦 В архиве файлов: ${files.length}`);
      
//       const imageFiles = files.filter(name => 
//         name.match(/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i)
//       );
      
//       console.log(`    📦 Изображений в архиве: ${imageFiles.length}`);
      
//       for (const imageName of imageFiles) {
//         const imageData = await zip.files[imageName].async('blob');
//         const url = URL.createObjectURL(imageData);
//         const key = fileId + '_' + imageName;
//         photos[key] = {
//           id: key,
//           name: imageName.split('/').pop(),
//           url: url,
//           type: 'image',
//           extension: imageName.split('.').pop()?.toLowerCase()
//         };
//         console.log(`      🖼️ Извлечено: ${imageName}`);
//       }
      
//     } catch (error) {
//       console.error(`  ❌ Ошибка распаковки ${fileName}:`, error);
//     }
    
//     return photos;
//   }

//   clearUrls(photos) {
//     if (!photos) return;
//     for (const photo of photos) {
//       if (photo.url && photo.url.startsWith('blob:')) {
//         URL.revokeObjectURL(photo.url);
//       }
//     }
//   }
// }