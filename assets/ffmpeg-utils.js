/**
 * FFmpeg工具函数
 * 负责FFmpeg的加载、初始化和配置
 */

// 全局变量
let ffmpeg;

/**
 * 加载FFmpeg库
 */
async function loadFFmpeg() {
    log('正在加载FFmpeg...');
    
    try {
        // 导入FFmpeg
        ffmpeg = createFFmpeg({
            log: ({ message }) => {
                // 仅记录重要日志，避免日志过多
                if (message.includes('error') || message.includes('warning') || 
                    message.includes('Output') || message.includes('Input')) {
                    log(`FFmpeg: ${message}`);
                }
            },
            corePath: '/assets/ffmpeg-core.js',
            wasmPath: '/assets/ffmpeg-core.wasm'
        });
        
        // 加载FFmpeg核心
        log('FFmpeg核心加载中...');
        await ffmpeg.load();
        
        log('FFmpeg加载完成，版本: ' + ffmpeg.version);
        
        return ffmpeg;
    } catch (error) {
        log(`FFmpeg加载失败: ${error.message}`);
        alert('FFmpeg加载失败，请刷新页面重试。错误: ' + error.message);
        throw error;
    }
}

/**
 * 检查FFmpeg是否已初始化
 * @returns {boolean} FFmpeg是否已初始化
 */
function isFFmpegInitialized() {
    return ffmpeg && ffmpeg.isLoaded();
}

/**
 * 获取FFmpeg实例
 * @returns {Object} FFmpeg实例
 */
function getFFmpegInstance() {
    return ffmpeg;
}

/**
 * 清理FFmpeg资源
 */
async function cleanupFFmpeg() {
    if (!ffmpeg) return;
    
    try {
        // 清理内存中的临时文件
        const files = await ffmpeg.FS('readdir', '/');
        for (const file of files) {
            if (file !== '.' && file !== '..' && 
                (file.startsWith('input.') || file.startsWith('output.'))) {
                try {
                    await ffmpeg.FS('unlink', file);
                } catch (e) {
                    // 忽略清理错误
                }
            }
        }
    } catch (error) {
        log(`FFmpeg清理错误: ${error.message}`);
    }
}

/**
 * 创建FFmpeg命令
 * @param {string} inputFile 输入文件名
 * @param {Object} options 处理选项
 * @returns {Array} FFmpeg命令数组
 */
function createFFmpegCommand(inputFile, options = {}) {
    const command = ['-i', inputFile];
    
    // 应用音频参数
    if (options.channels) {
        command.push('-ac', options.channels);
    }
    
    if (options.samplerate) {
        command.push('-ar', options.samplerate);
    }
    
    // 音频编码器
    command.push('-acodec', options.codec || 'aac');
    
    // 比特率（仅有损格式）
    if (options.bitrate && options.supportsBitrate) {
        command.push('-b:a', options.bitrate);
    }
    
    // 特殊格式处理
    if (options.format === 'flac') {
        command.push('-compression_level', '5'); // FLAC 压缩级别
    } else if (options.format === 'aac' || options.format === 'm4a') {
        command.push('-strict', 'experimental'); // AAC 编码器兼容性
    }
    
    // 输出文件名
    command.push(options.outputFile || 'output.mp3');
    
    return command;
}

/**
 * 读取文件到FFmpeg内存
 * @param {File} file 要读取的文件
 * @param {string} filename 目标文件名
 */
async function writeFileToFFmpeg(file, filename) {
    try {
        await ffmpeg.writeFile(filename, await fetchFile(file));
        return true;
    } catch (error) {
        log(`写入文件到FFmpeg失败: ${error.message}`);
        return false;
    }
}

/**
 * 从FFmpeg内存读取文件
 * @param {string} filename 文件名
 * @returns {Uint8Array} 文件数据
 */
async function readFileFromFFmpeg(filename) {
    try {
        return await ffmpeg.readFile(filename);
    } catch (error) {
        log(`从FFmpeg读取文件失败: ${error.message}`);
        throw error;
    }
}

/**
 * 删除FFmpeg内存中的文件
 * @param {string} filename 文件名
 */
async function deleteFileFromFFmpeg(filename) {
    try {
        await ffmpeg.deleteFile(filename);
    } catch (error) {
        // 忽略删除错误
    }
}

/**
 * 执行FFmpeg命令
 * @param {Array} command FFmpeg命令数组
 */
async function executeFFmpegCommand(command) {
    try {
        log(`执行FFmpeg命令: ${command.join(' ')}`);
        await ffmpeg.exec(command);
        return true;
    } catch (error) {
        log(`FFmpeg命令执行失败: ${error.message}`);
        throw error;
    }
}

/**
 * 获取FFmpeg支持的格式列表
 * @returns {Array} 支持的格式列表
 */
async function getSupportedFormats() {
    try {
        // 获取输出格式列表
        await ffmpeg.exec(['-formats']);
        
        // 这里应该解析日志获取格式列表，但为了简化，我们返回预设的常用格式
        return ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac'];
    } catch (error) {
        log(`获取格式列表失败: ${error.message}`);
        return ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac'];
    }
}

/**
 * 获取媒体文件元数据
 * @param {File} file 媒体文件
 * @returns {Object} 元数据对象
 */
async function getMediaMetadata(file) {
    if (!ffmpeg || !ffmpeg.isLoaded()) {
        throw new Error('FFmpeg未初始化');
    }
    
    try {
        const inputName = 'input.' + getFileExtension(file.name);
        await ffmpeg.writeFile(inputName, await fetchFile(file));
        
        // 尝试解析元数据（预期会失败，因为没有指定输出）
        try {
            await ffmpeg.exec(['-i', inputName]);
        } catch (error) {
            // 预期会失败，继续处理
        }
        
        // 清理文件
        await deleteFileFromFFmpeg(inputName);
        
        // 元数据解析需要从日志中提取，这里返回解析结果
        return parseMetadata(logEl.innerText);
    } catch (error) {
        log(`获取媒体元数据失败: ${error.message}`);
        throw error;
    }
}

/**
 * 解析FFmpeg输出的元数据
 * @param {string} logs FFmpeg日志输出
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