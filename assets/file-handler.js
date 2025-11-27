/**
 * 文件处理模块
 * 负责文件上传、元数据解析和下载功能
 */

/**
 * 处理文件上传
 * @param {FileList} files 文件列表
 * @returns {Promise<Array>} 文件对象数组
 */
function handleFileUpload(files) {
    const fileArray = Array.from(files);
    
    // 验证文件格式
    const validFiles = [];
    const invalidFiles = [];
    
    for (const file of fileArray) {
        if (isAudioFile(file)) {
            validFiles.push(file);
        } else {
            invalidFiles.push(file.name);
        }
    }
    
    if (invalidFiles.length > 0) {
        log(`忽略非音频文件: ${invalidFiles.join(', ')}`);
    }
    
    return validFiles;
}

/**
 * 检查是否为有效的音频文件
 * @param {File} file 文件对象
 * @returns {boolean} 是否为有效音频文件
 */
function isAudioFile(file) {
    const validExtensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
    const ext = getFileExtension(file.name).toLowerCase();
    const type = file.type.startsWith('audio/');
    
    return validExtensions.includes(ext) || type;
}

/**
 * 解析文件元数据
 * @param {string} logs FFmpeg输出日志
 * @returns {Object} 解析后的元数据
 */
function parseMetadata(logs) {
    // 初始化默认值
    const metadata = {
        duration: '未知',
        sampleRate: '未知',
        channels: '未知',
        bitrate: '未知'
    };
    
    // 尝试从日志中提取持续时间
    const durationMatch = logs.match(/Duration: ([0-9][0-9]:[0-9][0-9]:[0-9][0-9]\.[0-9]+)/);
    if (durationMatch && durationMatch[1]) {
        metadata.duration = durationMatch[1];
    }
    
    // 尝试提取采样率
    const sampleRateMatch = logs.match(/(\d+) Hz/);
    if (sampleRateMatch && sampleRateMatch[1]) {
        metadata.sampleRate = sampleRateMatch[1] + ' Hz';
    }
    
    // 尝试提取声道数
    const channelsMatch = logs.match(/(mono|stereo|\d+ channels)/);
    if (channelsMatch && channelsMatch[1]) {
        metadata.channels = channelsMatch[1];
    }
    
    // 尝试提取比特率
    const bitrateMatch = logs.match(/(\d+(\.\d+)?) kbps/);
    if (bitrateMatch && bitrateMatch[1]) {
        metadata.bitrate = bitrateMatch[1] + ' kbps';
    }
    
    return metadata;
}

/**
 * 显示文件元数据
 * @param {Object} metadata 文件元数据
 * @param {HTMLElement} container 容器元素
 */
function displayFileMetadata(metadata, container) {
    if (!container) return;
    
    container.innerHTML = `
        <div class="metadata-item">
            <span class="metadata-label">持续时间:</span>
            <span class="metadata-value">${metadata.duration}</span>
        </div>
        <div class="metadata-item">
            <span class="metadata-label">采样率:</span>
            <span class="metadata-value">${metadata.sampleRate}</span>
        </div>
        <div class="metadata-item">
            <span class="metadata-label">声道:</span>
            <span class="metadata-value">${metadata.channels}</span>
        </div>
        <div class="metadata-item">
            <span class="metadata-label">比特率:</span>
            <span class="metadata-value">${metadata.bitrate}</span>
        </div>
    `;
}

/**
 * 获取文件扩展名
 * @param {string} filename 文件名
 * @returns {string} 文件扩展名
 */
function getFileExtension(filename) {
    return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
}

/**
 * 生成下载链接
 * @param {Blob} blob 文件Blob对象
 * @param {string} filename 文件名
 * @returns {string} 下载URL
 */
function generateDownloadUrl(blob, filename) {
    const url = URL.createObjectURL(blob);
    return url;
}

/**
 * 下载文件
 * @param {Blob} blob 文件Blob对象
 * @param {string} filename 文件名
 */
function downloadFile(blob, filename) {
    const url = generateDownloadUrl(blob, filename);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 清理URL对象
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * 批量下载文件为ZIP
 * @param {Array} fileObjects 文件对象数组 [{blob, filename}]
 * @returns {Promise} 完成下载的Promise
 */
async function downloadFilesAsZip(fileObjects) {
    try {
        const zip = new JSZip();
        
        // 添加所有文件到ZIP
        for (const fileObj of fileObjects) {
            if (fileObj.blob && fileObj.filename) {
                // 读取Blob数据
                const arrayBuffer = await readBlobAsArrayBuffer(fileObj.blob);
                zip.file(fileObj.filename, arrayBuffer);
            }
        }
        
        // 生成ZIP文件
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        // 下载ZIP
        const timestamp = new Date().getTime();
        downloadFile(zipBlob, `audio_files_${timestamp}.zip`);
        
        return true;
    } catch (error) {
        log(`ZIP打包失败: ${error.message}`);
        return false;
    }
}

/**
 * 将Blob读取为ArrayBuffer
 * @param {Blob} blob Blob对象
 * @returns {Promise<ArrayBuffer>} ArrayBuffer数据
 */
function readBlobAsArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.readAsArrayBuffer(blob);
    });
}

/**
 * 格式化文件大小
 * @param {number} bytes 字节数
 * @returns {string} 格式化的大小字符串
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 获取文件类型图标
 * @param {string} extension 文件扩展名
 * @returns {string} 图标CSS类名
 */
function getFileTypeIcon(extension) {
    const iconMap = {
        mp3: 'icon-mp3',
        wav: 'icon-wav',
        m4a: 'icon-m4a',
        ogg: 'icon-ogg',
        flac: 'icon-flac',
        aac: 'icon-aac'
    };
    
    return iconMap[extension.toLowerCase()] || 'icon-audio';
}

/**
 * 验证文件大小限制
 * @param {File} file 文件对象
 * @param {number} maxSizeMB 最大文件大小（MB）
 * @returns {boolean} 是否在大小限制内
 */
function validateFileSize(file, maxSizeMB = 100) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
}

/**
 * 过滤支持的音频文件
 * @param {FileList} files 文件列表
 * @returns {Array} 过滤后的文件数组
 */
function filterAudioFiles(files) {
    const validExtensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
    const fileArray = Array.from(files);
    
    return fileArray.filter(file => {
        const ext = getFileExtension(file.name).toLowerCase();
        return validExtensions.includes(ext);
    });
}

/**
 * 生成唯一文件名
 * @param {string} originalName 原始文件名
 * @param {string} extension 文件扩展名
 * @returns {string} 唯一文件名
 */
function generateUniqueFilename(originalName, extension = null) {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const timestamp = Date.now();
    const ext = extension || getFileExtension(originalName);
    
    return `${nameWithoutExt}_${timestamp}.${ext}`;
}

/**
 * 解析文件元数据（使用FFmpeg）
 * @param {File} file 音频文件
 * @returns {Promise<Object>} 元数据对象
 */
async function parseAudioMetadata(file) {
    const inputExt = getFileExtension(file.name);
    const inputName = 'input.' + inputExt;
    
    try {
        // 写入文件到内存
        await ffmpeg.writeFile(inputName, await fetchFile(file));
        
        // 清空之前的日志
        const prevLogLength = logEl.innerText.length;
        
        // 运行 -i 命令获取元数据（会产生错误，但这是正常的）
        try {
            await ffmpeg.exec(['-i', inputName]);
        } catch (error) {
            // 预期会失败，继续处理
        }
        
        // 提取新的日志内容
        const logs = logEl.innerText.substring(prevLogLength);
        
        // 解析元数据
        const metadata = parseMetadata(logs);
        
        // 清理文件
        try {
            await ffmpeg.deleteFile(inputName);
        } catch (e) {
            // 忽略清理错误
        }
        
        return metadata;
        
    } catch (error) {
        log(`元数据解析失败: ${error.message}`);
        return null;
    }
}

/**
 * 更新文件状态显示
 * @param {string} fileId 文件ID或索引
 * @param {string} status 状态（processing/error/success）
 * @param {string} message 状态消息
 */
function updateFileStatus(fileId, status, message) {
    const statusElement = document.getElementById(`file-status-${fileId}`);
    if (!statusElement) return;
    
    // 移除所有状态类
    statusElement.classList.remove('status-processing', 'status-error', 'status-success');
    
    // 添加当前状态类
    statusElement.classList.add(`status-${status}`);
    statusElement.textContent = message;
}