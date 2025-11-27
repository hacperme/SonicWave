/**
 * 音频处理模块
 * 负责音频压缩、转换等核心处理逻辑
 */

/**
 * 单个文件压缩处理
 * @param {File} file 输入文件
 * @returns {Object} 处理结果对象
 */
async function compressSingleFile(file) {
    const inputExt = getFileExtension(file.name);
    const inputName = 'input.' + inputExt;
    const format = formatConfig[outputFormat.value];
    const outputName = 'output.' + format.ext;
    
    try {
        // 写入文件到内存
        await ffmpeg.writeFile(inputName, await fetchFile(file));

        const command = ['-i', inputName];
        
        // 应用参数
        const ac = outputChannels.value;
        if (ac) command.push('-ac', ac);

        const ar = outputSamplerate.value;
        if (ar) command.push('-ar', ar);
        
        // 音频编码器
        command.push('-acodec', format.codec);
        
        // 比特率（仅有损格式）
        const ba = outputBitrate.value;
        if (ba && format.supportsBitrate) {
            command.push('-b:a', ba);
        }
        
        // 无损格式特殊处理
        if (outputFormat.value === 'flac') {
            command.push('-compression_level', '5'); // FLAC 压缩级别 0-12
        } else if (outputFormat.value === 'aac') {
            command.push('-strict', 'experimental'); // AAC 编码器兼容性
        }

        command.push(outputName);
        
        // 执行 FFmpeg 命令
        await ffmpeg.exec(command);
        
        // 读取输出文件
        const data = await ffmpeg.readFile(outputName);
        
        // 创建下载链接
        const mimeType = {
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            m4a: 'audio/mp4',
            ogg: 'audio/ogg',
            flac: 'audio/flac'
        }[format.ext] || 'audio/*';
        
        const blob = new Blob([data.buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const baseName = file.name.replace(/\.[^/.]+$/, ''); // 去除原扩展名
        const filename = `${baseName}_converted.${format.ext}`;
        
        return { blob, url, filename };
        
    } finally {
        // 清理内存
        try {
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);
        } catch (e) { /* 忽略清理错误 */ }
    }
}

/**
 * 带重试的压缩函数
 * @param {File} file 输入文件
 * @param {number} maxRetries 最大重试次数
 * @returns {Object} 处理结果对象
 */
async function compressSingleFileWithRetry(file, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await compressSingleFile(file);
        } catch (error) {
            if (attempt < maxRetries) {
                log(`⚠️ 第 ${attempt + 1} 次尝试失败，重试中...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                throw error;
            }
        }
    }
}

/**
 * 批量压缩文件
 * @param {FileList} files 文件列表
 * @returns {Array} 处理结果数组
 */
async function compressMultipleFiles(files) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
            const result = await compressSingleFile(file);
            results.push({
                success: true,
                file: file.name,
                result
            });
        } catch (error) {
            errors.push({
                success: false,
                file: file.name,
                error: error.message
            });
        }
    }
    
    return {
        results,
        errors
    };
}

/**
 * 转换音频格式
 * @param {File} file 输入文件
 * @param {string} targetFormat 目标格式
 * @param {Object} options 转换选项
 * @returns {Object} 转换结果
 */
async function convertAudioFormat(file, targetFormat, options = {}) {
    const inputExt = getFileExtension(file.name);
    const inputName = 'input.' + inputExt;
    const config = formatConfig[targetFormat];
    const outputName = 'output.' + config.ext;
    
    try {
        // 写入文件到内存
        await ffmpeg.writeFile(inputName, await fetchFile(file));
        
        // 创建转换命令
        const command = ['-i', inputName];
        
        // 应用选项
        if (options.channels) command.push('-ac', options.channels);
        if (options.samplerate) command.push('-ar', options.samplerate);
        if (options.bitrate && config.supportsBitrate) {
            command.push('-b:a', options.bitrate);
        }
        
        // 设置编码器
        command.push('-acodec', config.codec);
        
        // 特殊格式处理
        if (targetFormat === 'flac') {
            command.push('-compression_level', options.compressionLevel || '5');
        } else if (targetFormat === 'aac') {
            command.push('-strict', 'experimental');
        }
        
        command.push(outputName);
        
        // 执行转换
        await ffmpeg.exec(command);
        
        // 读取输出
        const data = await ffmpeg.readFile(outputName);
        
        // 创建Blob
        const mimeType = {
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            m4a: 'audio/mp4',
            ogg: 'audio/ogg',
            flac: 'audio/flac'
        }[config.ext] || 'audio/*';
        
        const blob = new Blob([data.buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const filename = `${baseName}.${config.ext}`;
        
        return { blob, url, filename };
        
    } finally {
        // 清理内存
        try {
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);
        } catch (e) { /* 忽略清理错误 */ }
    }
}

/**
 * 压缩音频比特率
 * @param {File} file 输入文件
 * @param {string} bitrate 目标比特率
 * @returns {Object} 处理结果
 */
async function compressAudioBitrate(file, bitrate) {
    const format = getFileExtension(file.name);
    const config = formatConfig[format];
    
    // 检查格式是否支持比特率设置
    if (!config || !config.supportsBitrate) {
        throw new Error(`格式 ${format.toUpperCase()} 不支持设置比特率`);
    }
    
    // 使用相同格式压缩比特率
    return convertAudioFormat(file, format, { bitrate });
}

/**
 * 调整音频采样率
 * @param {File} file 输入文件
 * @param {string} samplerate 目标采样率
 * @returns {Object} 处理结果
 */
async function changeAudioSamplerate(file, samplerate) {
    const format = getFileExtension(file.name);
    
    // 保持格式不变，仅调整采样率
    return convertAudioFormat(file, format, { samplerate });
}

/**
 * 调整声道数
 * @param {File} file 输入文件
 * @param {string} channels 目标声道数
 * @returns {Object} 处理结果
 */
async function changeAudioChannels(file, channels) {
    const format = getFileExtension(file.name);
    
    // 保持格式不变，仅调整声道数
    return convertAudioFormat(file, format, { channels });
}

/**
 * 估计压缩后的文件大小
 * @param {File} file 原始文件
 * @param {string} targetBitrate 目标比特率
 * @returns {number} 估计的文件大小（字节）
 */
function estimateOutputSize(file, targetBitrate) {
    // 简单估计：比特率(bps) * 时长(秒) / 8 = 文件大小(字节)
    // 注意：这是非常粗略的估计，实际结果会有所不同
    
    // 尝试从文件名或内容中提取时长信息
    // 这里我们使用一个简化的估计
    const bitrateValue = parseInt(targetBitrate);
    
    if (isNaN(bitrateValue)) {
        return file.size; // 如果无法估计，返回原始大小
    }
    
    // 假设平均比特率和时长的关系
    const originalBitrate = Math.round(file.size * 8 / 10); // 简化估计
    
    // 按比特率比例估计
    const estimatedSize = Math.round((file.size * bitrateValue) / originalBitrate);
    
    return Math.max(estimatedSize, 1024); // 确保最小大小
}

/**
 * 计算压缩率
 * @param {number} originalSize 原始大小（字节）
 * @param {number} compressedSize 压缩后大小（字节）
 * @returns {number} 压缩率百分比
 */
function calculateCompressionRatio(originalSize, compressedSize) {
    if (originalSize <= 0) return 0;
    
    const ratio = ((originalSize - compressedSize) / originalSize) * 100;
    return Math.round(ratio * 10) / 10; // 保留一位小数
}

/**
 * 获取推荐的压缩参数
 * @param {File} file 输入文件
 * @param {string} targetFormat 目标格式
 * @returns {Object} 推荐的参数
 */
function getRecommendedCompressionParams(file, targetFormat) {
    const ext = getFileExtension(file.name);
    const isLossless = ['wav', 'flac'].includes(ext);
    
    // 默认参数
    const params = {
        bitrate: '128k',
        samplerate: '44100',
        channels: '2'
    };
    
    // 根据目标格式调整推荐参数
    switch (targetFormat) {
        case 'mp3':
            params.bitrate = isLossless ? '256k' : '192k';
            break;
        case 'm4a':
            params.bitrate = isLossless ? '256k' : '160k';
            break;
        case 'ogg':
            params.bitrate = isLossless ? '192k' : '128k';
            break;
        case 'flac':
            // 无损格式，不设置比特率
            params.bitrate = '';
            break;
        case 'wav':
            // WAV格式，不设置比特率
            params.bitrate = '';
            break;
    }
    
    return params;
}