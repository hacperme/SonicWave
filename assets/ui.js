/**
 * UI模块
 * 负责UI元素更新和交互处理函数
 */

/**
 * 更新UI状态
 * @param {string} state 状态名称
 * @param {Object} data 状态数据
 */
function updateUIState(state, data = {}) {
    switch (state) {
        case 'loading':
            showLoadingIndicator(data.message || '处理中...');
            break;
        case 'ready':
            hideLoadingIndicator();
            break;
        case 'error':
            showError(data.message || '发生错误');
            break;
        case 'success':
            showSuccess(data.message || '操作成功');
            break;
        case 'fileList':
            updateFileList(data.files || []);
            break;
    }
}

/**
 * 显示加载指示器
 * @param {string} message 加载消息
 */
function showLoadingIndicator(message) {
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) {
        loadingEl.querySelector('.loading-message').textContent = message;
        loadingEl.classList.remove('hidden');
    }
}

/**
 * 隐藏加载指示器
 */
function hideLoadingIndicator() {
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) {
        loadingEl.classList.add('hidden');
    }
}

/**
 * 显示错误消息
 * @param {string} message 错误消息
 * @param {boolean} autoHide 是否自动隐藏
 */
function showError(message, autoHide = true) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
        
        if (autoHide) {
            setTimeout(() => {
                hideError();
            }, 5000);
        }
    }
}

/**
 * 隐藏错误消息
 */
function hideError() {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.classList.add('hidden');
    }
}

/**
 * 显示成功消息
 * @param {string} message 成功消息
 */
function showSuccess(message) {
    const successEl = document.getElementById('success-message');
    if (successEl) {
        successEl.textContent = message;
        successEl.classList.remove('hidden');
        
        setTimeout(() => {
            hideSuccess();
        }, 3000);
    }
}

/**
 * 隐藏成功消息
 */
function hideSuccess() {
    const successEl = document.getElementById('success-message');
    if (successEl) {
        successEl.classList.add('hidden');
    }
}

/**
 * 更新文件列表UI
 * @param {Array} files 文件数组
 */
function updateFileList(files) {
    const fileListEl = document.getElementById('file-list');
    if (!fileListEl) return;
    
    fileListEl.innerHTML = '';
    
    if (files.length === 0) {
        fileListEl.innerHTML = '<div class="no-files">未选择文件</div>';
        return;
    }
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileItem = createFileItemElement(file, i);
        fileListEl.appendChild(fileItem);
    }
}

/**
 * 创建文件项元素
 * @param {File} file 文件对象
 * @param {number} index 文件索引
 * @returns {HTMLElement} 文件项元素
 */
function createFileItemElement(file, index) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.index = index;
    
    const ext = getFileExtension(file.name);
    const fileSize = formatFileSize(file.size);
    
    fileItem.innerHTML = `
        <div class="file-icon ${getFileTypeIcon(ext)}"></div>
        <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-details">${fileSize} · ${ext.toUpperCase()}</div>
        </div>
        <div class="file-status" id="file-status-${index}">等待处理</div>
    `;
    
    return fileItem;
}

/**
 * 更新处理进度
 * @param {number} progress 进度百分比 (0-100)
 * @param {string} message 进度消息
 */
function updateProgress(progress, message) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        
        if (progress >= 100) {
            progressBar.classList.add('complete');
        } else {
            progressBar.classList.remove('complete');
        }
    }
    
    if (progressText && message) {
        progressText.textContent = message;
    }
    
    // 显示/隐藏进度条容器
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
        if (progress > 0 && progress < 100) {
            progressContainer.classList.remove('hidden');
        } else if (progress >= 100) {
            setTimeout(() => {
                progressContainer.classList.add('hidden');
            }, 500);
        }
    }
}

/**
 * 重置进度条
 */
function resetProgress() {
    updateProgress(0, '');
}

/**
 * 更新下载区域
 * @param {Object} downloadData 下载数据 {url, filename, size}
 */
function updateDownloadArea(downloadData) {
    const downloadArea = document.getElementById('download-area');
    const downloadLink = document.getElementById('download-link');
    const downloadInfo = document.getElementById('download-info');
    
    if (downloadLink && downloadData.url && downloadData.filename) {
        downloadLink.href = downloadData.url;
        downloadLink.download = downloadData.filename;
        downloadLink.textContent = downloadData.filename;
    }
    
    if (downloadInfo && downloadData.size) {
        downloadInfo.textContent = `文件大小: ${downloadData.size}`;
    }
    
    if (downloadArea) {
        downloadArea.classList.remove('hidden');
    }
}

/**
 * 重置下载区域
 */
function resetDownloadArea() {
    const downloadArea = document.getElementById('download-area');
    if (downloadArea) {
        downloadArea.classList.add('hidden');
    }
}

/**
 * 启用/禁用按钮
 * @param {string} selector 按钮选择器
 * @param {boolean} disabled 是否禁用
 */
function setButtonState(selector, disabled) {
    const button = document.querySelector(selector);
    if (button) {
        button.disabled = disabled;
    }
}

/**
 * 更新按钮文本
 * @param {string} selector 按钮选择器
 * @param {string} text 按钮文本
 */
function updateButtonText(selector, text) {
    const button = document.querySelector(selector);
    if (button) {
        button.textContent = text;
    }
}

/**
 * 显示拖拽上传提示
 * @param {boolean} show 是否显示
 */
function toggleDragDropHint(show) {
    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        if (show) {
            dropArea.classList.add('drag-over');
        } else {
            dropArea.classList.remove('drag-over');
        }
    }
}

/**
 * 更新格式选项UI
 * @param {string} format 选中的格式
 */
function updateFormatUI(format) {
    // 更新比特率选项（无损格式不需要比特率）
    const bitrateContainer = document.getElementById('bitrate-container');
    const config = formatConfig[format];
    
    if (bitrateContainer) {
        bitrateContainer.classList.toggle('hidden', !config.supportsBitrate);
    }
    
    // 其他格式特定的UI更新
    switch (format) {
        case 'flac':
            showCompressionOptions();
            break;
        default:
            hideCompressionOptions();
            break;
    }
}

/**
 * 显示压缩选项
 */
function showCompressionOptions() {
    const compressionContainer = document.getElementById('compression-container');
    if (compressionContainer) {
        compressionContainer.classList.remove('hidden');
    }
}

/**
 * 隐藏压缩选项
 */
function hideCompressionOptions() {
    const compressionContainer = document.getElementById('compression-container');
    if (compressionContainer) {
        compressionContainer.classList.add('hidden');
    }
}

/**
 * 更新统计信息
 * @param {Object} stats 统计数据
 */
function updateStatistics(stats) {
    const statsEl = document.getElementById('statistics');
    if (!statsEl) return;
    
    let statsHTML = '';
    
    if (stats.totalFiles !== undefined) {
        statsHTML += `<div class="stat-item">总文件: ${stats.totalFiles}</div>`;
    }
    
    if (stats.successFiles !== undefined) {
        statsHTML += `<div class="stat-item">成功: ${stats.successFiles}</div>`;
    }
    
    if (stats.failedFiles !== undefined) {
        statsHTML += `<div class="stat-item">失败: ${stats.failedFiles}</div>`;
    }
    
    if (stats.totalSize !== undefined) {
        statsHTML += `<div class="stat-item">原始大小: ${stats.totalSize}</div>`;
    }
    
    if (stats.compressedSize !== undefined) {
        statsHTML += `<div class="stat-item">压缩后: ${stats.compressedSize}</div>`;
    }
    
    if (stats.compressionRatio !== undefined) {
        statsHTML += `<div class="stat-item">压缩率: ${stats.compressionRatio}%</div>`;
    }
    
    statsEl.innerHTML = statsHTML;
    statsEl.classList.toggle('hidden', statsHTML === '');
}