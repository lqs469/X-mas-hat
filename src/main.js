import * as faceapi from 'face-api.js';
import './style.css';

document.onreadystatechange = async function() {
  if (document.readyState === 'complete') {
    const hatsContainer = $('hatsContainer');
    for(let i = 20; i >= 0; i--) {
      let img = document.createElement('img');
      const source = require(`./img/hat${i}.png`).default;
      img.src = `./${source}`;
      img.id = `hat${i}`;
      img.class = 'hat-item';
      hatsContainer.appendChild(img);
    }
  }

  await faceapi.nets.ssdMobilenetv1.loadFromUri('./weights');
  $('overlay').style.display = 'none';
};

const $ = id => document.getElementById(id);

class Img {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.image = null;
    this.cvs = $('cvs');
    this.ctx = this.cvs.getContext('2d');
    this.canvasFabric = null;
    this.detectResult = [];
    this.activeHat = null;
    this.exportImageContainer = $('export');
    this.init = this.init.bind(this);
    this.changeHat = this.changeHat.bind(this);
    this.export = this.export.bind(this);
    this.setStep(1);
  }

  vaildExtension(file) {
    const validFileExtensions = ['.jpg', '.jpeg', '.bmp', '.gif', '.png'];
    const fileName = file.name.toString().toLowerCase();

    return new RegExp(
      `(${validFileExtensions.join('|').replace(/\./g, '\\.')})$`
    ).test(fileName);
  }

  init(file, buffer) {
    $('overlay').style.display = 'flex';
    if (!this.vaildExtension(file)) {
      alert('请上传图片格式的文件');
      return;
    }
    this.setStep(2);
    this.image = new Image();
    this.image.src = buffer;
    this.image.onload = () => {
      let height = 0;
      let width = 0;
      const { naturalWidth, naturalHeight } = this.image;

      if (naturalWidth > naturalHeight) {
        width = Math.min(window.screen.width, 500);
        height = (naturalHeight / naturalWidth) * width;
      } else {
        height = Math.min(window.screen.width, 500);
        width = (naturalWidth / naturalHeight) * height;
      }

      this.width = width;
      this.height = height;
      this.image.width = width;
      this.image.height = height;
      this.cvs.width = width;
      this.cvs.height = height;

      this.detectFace();
    };
  }

  async detectFace() {
    this.detectResult = await faceapi.detectAllFaces(this.image);
    $('overlay').style.display = 'none';
    this.convertImg2Cvs(this.image);
  }

  rgba_to_grayscale(rgba, nrows, ncols) {
    const gray = new Uint8Array(nrows * ncols);
    for (let r = 0; r < nrows; ++r)
      for (let c = 0; c < ncols; ++c)
        // gray = 0.2*red + 0.7*green + 0.1*blue
        gray[r * ncols + c] =
          (2 * rgba[r * 4 * ncols + 4 * c + 0] +
            7 * rgba[r * 4 * ncols + 4 * c + 1] +
            1 * rgba[r * 4 * ncols + 4 * c + 2]) /
          10;
    return gray;
  }

  addHat(clickHat) {
    const { width, height } = this;
    const hat = new Hat(
      clickHat,
      height / 2 - 25,
      width / 2 - 25,
      clickHat.naturalWidth,
      clickHat.naturalHeight,
    );

    if (hat) {
      this.canvasFabric.add(hat);
      this.canvasFabric.setActiveObject(hat);
      this.activeHat = hat;
      $('delete').style.display = 'block';
    }
  }

  changeHat(hatImage) {
    if (!this.activeHat) {
      // TODO
      // const all = this.canvasFabric.getObjects();
      // if (all.length > 0) {
      //     all.forEach(hat => {
      //         hat.setElement(hatImage);
      //     });
      // } else {
      // }
      this.addHat(hatImage);
    } else {
      this.activeHat.setElement(hatImage);
    }
    this.canvasFabric.requestRenderAll();
  }

  removeHat(hat) {
    hat && this.canvasFabric.remove(hat);
    $('delete').style.display = 'none';
    this.activeHat = null;
  }

  export() {
    this.setStep(3);
    const { exportImageContainer, width, height } = this;

    exportImageContainer.src = this.canvasFabric.toDataURL({
      format: 'png',
      width: width,
      height: height,
      quality: 1,
      multiplier: 0.5,
    });
    this.canvasFabric && this.canvasFabric.dispose();
    this.canvasFabric = null;
  }

  tip(text) {
    $('tip').innerHTML = text;
  }

  setStep(step) {
    switch (step) {
      case 1:
        $('header').style.display = 'flex';
        $('hatsContainer').style.display = 'none';
        $('uploadContainer').style.display = 'flex';
        $('upload').style.display = 'block';
        $('footer').style.display = 'none';
        $('export').style.display = 'none';
        $('exportBtn').style.display = 'block';
        this.cvs.style.display = 'none';
        this.tip('');
        break;
      case 2:
        $('header').style.display = 'none';
        $('hatsContainer').style.display = 'flex';
        $('uploadContainer').style.display = 'none';
        $('upload').style.display = 'none';
        $('footer').style.display = 'flex';
        // $('addHat').style.display = 'block';
        $('export').style.display = 'none';
        $('exportBtn').style.display = 'block';
        this.cvs.style.display = 'block';
        this.tip('');
        break;
      case 3:
        $('delete').style.display = 'none';
        $('hatsContainer').style.display = 'none';
        $('exportBtn').style.display = 'none';
        // $('addHat').style.display = 'none';
        this.tip('长按图片保存或分享');
        this.cvs.style.display = 'none';
        this.exportImageContainer.style.display = 'block';
        break;
      default:
    }
  }

  convertImg2Cvs() {
    const { cvs, image, width, height, detectResult } = this;
    this.canvasFabric && this.canvasFabric.dispose();

    const { naturalWidth, naturalHeight } = image;
    this.canvasFabric = new fabric.Canvas(cvs, {
      width,
      height,
      backgroundImage: new fabric.Image(image, {
        width: naturalWidth,
        height: naturalHeight,
        scaleX: width / naturalWidth,
        scaleY: height / naturalHeight,
      }),
    });

    this.canvasFabric.on('mouse:down', e => {
      if (e.target) {
        this.activeHat = this.canvasFabric.getActiveObject();
        $('delete').style.display = 'block';
      } else {
        this.activeHat = null;
        $('delete').style.display = 'none';
      }
    });

    this.canvasFabric.on('after:render', function() {
      console.log('rendered');
      // this.calcOffset();
    });

    // const canvas = $('canvas');
    // faceapi.matchDimensions(canvas, image);
    // faceapi.draw.drawDetections(canvas, faceapi.resizeResults(detectResult, image))
    
    this.canvasFabric.requestRenderAll();

    const resizeResults = faceapi.resizeResults(detectResult, image)
    
    const hatLength = $('hatsContainer').children.length;
    resizeResults.forEach(({box}) => {
      const defaultHatImg = $(`hat${Math.floor(Math.random() * hatLength)}`);
      const { top, left, width, height } = box;
      console.log(box);

      const hat = new Hat(
        defaultHatImg,
        top,
        left,
        width,
        height,
      );

      this.canvasFabric.add(hat);
    });
  }
}

class Hat {
  constructor(hatImage, top, left, width, height) {
    if (!hatImage || !top || !left) {
      return null;
    }

    const instance = new fabric.Image(hatImage, {
      top: top - height * 0.6,
      left: left - width * 0.25,
      width: hatImage.naturalWidth,
      height: hatImage.naturalHeight,
      scaleX: 1,
      scaleY: 1,
      centeredScaling: true,
      cornerColor: '#0b3a42',
      cornerStrokeColor: '#fff',
      cornerStyle: 'circle',
      transparentCorners: false,
      rotatingPointOffset: 20,
    });

    instance.setControlsVisibility({
      bl: false,
      mb: false,
      mr: false,
      tr: false,
      tl: false,
      ml: false,
      mt: false,
    });
    
    instance.scaleToWidth(width * 1.5, true);

    return instance;
  }
}

const img = new Img();

$('reuploadImg').addEventListener('click', () => {
  $('upload').click();
});

$('upload').addEventListener('change', () => {
  const file = $('upload').files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    img.init(file, reader.result);
  };
});

// $('addHat').addEventListener('click', () => {
//     img.addHat();
// });

$('delete').addEventListener('click', () => {
  img.removeHat(img.activeHat);
});

$('hatsContainer').addEventListener('click', e => {
  img.changeHat(e.target || e.srcElement);
});

$('exportBtn').addEventListener('click', () => {
  img.export();
});

// let facefinder_classify_region = (r, c, s, pixels, ldim) => -1.0;

// const cascadeurl = 'lib/facefinder.js';

// fetch(cascadeurl).then(response => {
//   response.arrayBuffer().then(buffer => {
//     const bytes = new Int8Array(buffer);
//     facefinder_classify_region = pico.unpack_cascade(bytes);
//     console.log('* cascade loaded');
//     $('overlay').style.display = 'none';
//   });
// });
