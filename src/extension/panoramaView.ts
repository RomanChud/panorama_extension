import { IDisposable, IOpenspaceView, PageContext, IObjectsRepository, IInitializable, InjectionSource } from "@pilotdev/pilot-web-sdk";
import { createApp, type App as AppType } from "vue";

import { VuePageAddress } from "./navigation";
import App from "../App.vue";

export class PanoramaView implements IOpenspaceView<PageContext>, IDisposable {
  private _panorama_rootElement: HTMLElement | undefined;
  private _panorama_vueApp: AppType<Element> | undefined;
  private _objectsRepository: IObjectsRepository | undefined;

  constructor() {
    console.log(`PanoramaView конструктор вызван`);
  }

  initialize(injectionSource: InjectionSource): void {
    this._objectsRepository = injectionSource.objectsRepository;
    console.log('Initialize:', this._objectsRepository);
  }

  getViewId(): string {
    console.log(`PanoramaView.getViewId() вызван [${VuePageAddress}]`);
    return VuePageAddress;
  }

  getView(): HTMLElement | undefined {
    console.log(`PanoramaView.getView() вызван [${VuePageAddress}]`);

    if (!this._panorama_rootElement) {
      this._panorama_rootElement = document.createElement("div");
      this._panorama_rootElement.setAttribute("panorama", "app-panorama");
    }

    if (!this._panorama_vueApp) {
      this._panorama_vueApp = createApp(App, {
        objectsRepository: this._objectsRepository
      });
    }

    this._panorama_vueApp.mount(this._panorama_rootElement);

    return this._panorama_rootElement;
  }

  dispose(): void {
    if (this._panorama_vueApp) {
      this._panorama_vueApp.unmount();
      this._panorama_vueApp = undefined;
    }

    if (this._panorama_rootElement) {
      this._panorama_rootElement = undefined;
    }
  }
}
