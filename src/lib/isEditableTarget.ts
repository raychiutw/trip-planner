/** 輸入框、選單內保留原生行為（複製貼上、文字刪除、Shift+F10 等）；checkbox / radio 不算輸入框。 */
export function isEditableTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement
    && !!t.closest('input:not([type="checkbox"]):not([type="radio"]),textarea,select,[contenteditable="true"],[role="menu"]');
}
