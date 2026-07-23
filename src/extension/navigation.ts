import {
  IPageNavigation,
  IPageNavigationBuilder,
} from "@pilotdev/pilot-web-sdk";

export const VuePageAddress = "panorama";

const dashboardIconBase64 = "PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMyAzSDEwVjEwSDNWM1oiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTE0IDNIMjFWMTBIMTRWMyIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMyAxNEgxMFYyMUgzVjE0IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNCAxNEgyMVYyMUgxNFYxNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=";

export class PanoramaNavigation implements IPageNavigation {
  public build(builder: IPageNavigationBuilder): void {
    const sectionBuilder = builder
      .addSection("panorama_extension", 0)
      .withTitle("Секция аналитики");

    sectionBuilder
      .addElement("panorama_item", 0)
      .withTitle("Панорама")
      .withDescription("Перейти на панораму")
      .withViewId(VuePageAddress)
      .withIcon("panorama_icon", dashboardIconBase64);

  }
}