/** jsdom no implementa `<dialog>.showModal()/close()`: se simulan para las pruebas de componentes. */
export function patchDialog(): void {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal: () => void;
    close: (value?: string) => void;
  };
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
