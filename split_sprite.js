const fs = require('fs');
const path = require('path');

async function processImage() {
    // 동적 import - jimp 모듈이 없으면 설치해야하므로 에러 대처
    let Jimp;
    try {
        Jimp = require('jimp');
    } catch (e) {
        console.error("Please run 'npm install jimp' first.");
        return;
    }

    const inPath = 'public/assets/worldmaptexture.png';
    const outDir = 'public/assets/ui/terrain/chunks';

    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outDir, { recursive: true });

    console.log("Loading image...");
    const image = await Jimp.read(inPath);
    
    console.log("Converting white background to transparent...");
    // 1. 하얀 배경(235 이상)을 모조리 투명하게 (알파채널 0)
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        if (r > 235 && g > 235 && b > 235) {
            this.bitmap.data[idx + 3] = 0; 
        }
    });

    console.log("Slicing and auto-cropping objects...");
    // 2. 가로 5등분, 세로 5등분 격자로 자른 뒤 Autocrop 처리
    const cols = 5;
    const rows = 5;
    const w = Math.floor(image.bitmap.width / cols);
    const h = Math.floor(image.bitmap.height / rows);

    let count = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const chunk = image.clone().crop(c * w, r * h, w, h);
            chunk.autocrop(); 
            
            // 너무 빈 이미지(투명 공간만 잘린 쓰레기 노이즈) 거르기
            if (chunk.bitmap.width < 15 || chunk.bitmap.height < 15) continue;
            
            // 좌표(c, r) 그리드 위치 기반 휴리스틱 네이밍
            let prefix = 'obj';
            if (r >= 4) prefix = 'water';
            else if (r >= 3 && c < 3) prefix = 'tree';
            else if (c >= 3) prefix = 'building';
            else prefix = 'mountain';
            
            // 파일 덮어쓰기 방지를 위한 랜덤 해시값 부착
            const fileName = `${prefix}_${Math.random().toString(36).substr(2, 4)}.png`;
            await chunk.writeAsync(path.join(outDir, fileName));
            count++;
        }
    }
    console.log(`Successfully extracted ${count} sprite pieces! Check out the '${outDir}' folder.`);
}

processImage().catch(console.error);
