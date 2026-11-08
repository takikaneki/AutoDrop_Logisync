// Pinapaliit ang larawan (proof of delivery) bago i-save para hindi mapuno ang storage ng browser o lumampas sa body limit ng server.
export function compressImage(file, max = 640, quality = 0.55) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) return reject(new Error("Please choose an image file."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const render = (targetMax, q) => {
        const scale = Math.min(1, targetMax / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", q);
      };
      let dataUrl = render(max, quality);
      if (dataUrl.length > 65000) {
        dataUrl = render(480, 0.45);
      }
      if (dataUrl.length > 65000) {
        dataUrl = render(360, 0.4);
      }
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be read."));
    };
    img.src = url;
  });
}
