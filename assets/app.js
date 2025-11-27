// SonicWave 主应用入口文件
// 整合所有模块功能

// 确保在DOM加载完成后执行
document.addEventListener('DOMContentLoaded', async () => {
  // 等待FFmpeg加载完成
  try {
    // 初始化FFmpeg
    await loadFFmpeg();
    
    // 初始化拖拽上传区域
    const dropZone = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-upload');
    const compressBtn = document.getElementById('compress-btn');
    
    // 设置拖拽事件处理
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      
      if (e.dataTransfer.files.length) {
        await handleFileUpload(e.dataTransfer.files);
      }
    });
    
    // 文件选择处理
    fileInput.addEventListener('change', async () => {
      if (fileInput.files.length) {
        await handleFileUpload(fileInput.files);
      }
    });
    
    // 压缩按钮点击事件
    compressBtn.addEventListener('click', async () => {
      await compressSelectedFiles();
    });
    
    // 显示初始化完成消息
    updateStatusMessage('SonicWave 已就绪，可以开始处理音频文件！', 'success');
  } catch (error) {
    console.error('应用初始化失败:', error);
    updateStatusMessage('应用初始化失败，请刷新页面重试。', 'error');
  }
});

// 压缩选中的文件
async function compressSelectedFiles() {
  try {
    // 获取选中的文件
    const selectedFiles = getSelectedFiles();
    
    if (selectedFiles.length === 0) {
      updateStatusMessage('请先选择要压缩的文件', 'warning');
      return;
    }
    
    // 显示加载状态
    showLoadingIndicator(true);
    updateStatusMessage('正在处理文件，请稍候...', 'info');
    
    // 获取压缩配置
    const bitrate = document.getElementById('bitrate-select').value;
    const format = document.getElementById('format-select').value;
    
    // 处理多个文件
    const results = await compressMultipleFiles(selectedFiles, { 
      bitrate,
      format,
      maxRetries: 3,
      retryDelay: 1000
    });
    
    // 显示结果
    updateStatusMessage(`成功处理 ${results.success.length} 个文件`, 'success');
    
    // 添加到下载区域
    addResultsToDownloadArea(results.success);
    
    // 如果有失败的文件，显示错误
    if (results.failed.length > 0) {
      updateStatusMessage(`部分文件处理失败: ${results.failed.map(f => f.name).join(', ')}`, 'error');
    }
    
  } catch (error) {
    console.error('压缩文件失败:', error);
    updateStatusMessage('文件处理失败，请查看控制台获取详细信息。', 'error');
  } finally {
    // 隐藏加载状态
    showLoadingIndicator(false);
  }
}

// 获取选中的文件
function getSelectedFiles() {
  const fileRows = document.querySelectorAll('#file-list tbody tr');
  const selectedFiles = [];
  
  fileRows.forEach(row => {
    const checkbox = row.querySelector('.file-checkbox');
    const fileName = row.querySelector('.file-name').textContent;
    const fileSize = row.querySelector('.file-size').getAttribute('data-size');
    
    if (checkbox && checkbox.checked) {
      // 重建文件对象（实际应用中可能需要存储原始文件引用）
      const fileObj = {
        name: fileName,
        size: parseInt(fileSize),
        // 在实际应用中，这里应该有原始的文件引用
      };
      selectedFiles.push(fileObj);
    }
  });
  
  return selectedFiles;
}