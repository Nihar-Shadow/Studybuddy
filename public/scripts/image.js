/* Image upload, preview, removal */
// ============ Image Upload Handlers ============
function triggerImageUpload() {
  imageInput.click();
}

function handleImageSelected() {
  const file = imageInput.files[0];
  if (!file) return;

  // Validate file type and size
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('Image must be smaller than 10MB');
    return;
  }

  pendingImage = file;
  attachBtn.classList.add('active');
  renderImagePreview();
}

function renderImagePreview() {
  imagePreviewContainer.innerHTML = '';

  if (!pendingImage) {
    attachBtn.classList.remove('active');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const container = document.createElement('div');
    container.className = 'image-preview-thumb';
    container.innerHTML = `
      <img src="${e.target.result}" alt="Preview">
      <button class="image-preview-remove" onclick="removeImage()">✕</button>
    `;
    imagePreviewContainer.appendChild(container);
  };
  reader.readAsDataURL(pendingImage);
}

function removeImage() {
  pendingImage = null;
  imageInput.value = '';
  renderImagePreview();
  attachBtn.classList.remove('active');
}
