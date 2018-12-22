const $ = id => document.getElementById(id);

let canvasFabric = null;

class Img {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.image = null;
        this.cvs = $('cvs');
        this.ctx = this.cvs.getContext('2d');
        this.canvasFabric = null;
        this.defaultHatImg = $('hat6');
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
        const fileName = file.name;

        return new RegExp(
            `(${validFileExtensions.join('|').replace(/\./g, '\\.')})$`
        ).test(fileName);
    }

    init(file, buffer) {
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
            this.convertImg2Cvs(this.image);
        };
    }

    detectFace() {
        const { width, height } = this;
        // const { width, height } = this.image;

        // re-draw the image to clear previous results and get its RGBA pixel data
        this.ctx.drawImage(this.image, 0, 0, width, height);
        const rgba = this.ctx.getImageData(0, 0, width, height).data;
        // prepare input to `run_cascade`
        const imageObj = {
            pixels: this.rgba_to_grayscale(rgba, width, height),
            nrows: height,
            ncols: width,
            ldim: width,
        };
        const params = {
            shiftfactor: 0.1, // move the detection window by 10% of its size
            minsize: 20, // minimum size of a face (not suitable for real-time detection, set it to 100 in that case)
            maxsize: 1000, // maximum size of a face
            scalefactor: 1.1, // for multiscale processing: resize the detection window by 10% when moving to the higher scale
        };
        // run the cascade over the image
        // dets is an array that contains (r, c, s, q) quadruplets
        // (representing row, column, scale and detection score)
        let dets = pico.run_cascade(
            imageObj,
            facefinder_classify_region,
            params
        );
        // cluster the obtained detections
        dets = pico.cluster_detections(dets, 0.2); // set IoU threshold to 0.2
        console.log(dets);
        // draw results
        const qthresh = 5.0; // this constant is empirical: other cascades might require a different one
        this.detectResult = dets.filter(det => det[3] > qthresh);
        // for (let i = 0; i < dets.length; ++i)
        //     // check the detection score
        //     // if it's above the threshold, draw it
        //     if (dets[i][3] > qthresh) {
        //         ctx.beginPath();
        //         ctx.arc(
        //             dets[i][1],
        //             dets[i][0],
        //             dets[i][2] / 2,
        //             0,
        //             2 * Math.PI,
        //             false
        //         );
        //         ctx.lineWidth = 3;
        //         ctx.strokeStyle = 'red';
        //         ctx.stroke();
        //     }

        // return next => next(img);
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

    convertImg2Cvs(image) {
        const { width, height, defaultHatImg, detectResult } = this;
        this.canvasFabric && this.canvasFabric.dispose();

        const { naturalWidth, naturalHeight } = image;
        this.canvasFabric = new fabric.Canvas(this.cvs, {
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
            this.calcOffset();
        });

        detectResult.forEach(det => {
            const factor = det[2] / defaultHatImg.width;
            const top = det[0] - defaultHatImg.height * factor;
            const left = det[1] - (defaultHatImg.width * factor) / 2;

            const hat = new Hat(defaultHatImg, top, left, factor);
            this.canvasFabric.add(hat);
        });

        this.canvasFabric.requestRenderAll();
    }

    addHat(clickHat) {
        const { width, height, defaultHatImg } = this;
        const hat = new Hat(
            clickHat || defaultHatImg,
            height / 2 - 25,
            width / 2 - 25,
            1
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
}

class Hat {
    constructor(hatImage, top, left, factor = 1) {
        if (!hatImage || !top || !left) {
            return null;
        }

        const instance = new fabric.Image(hatImage, {
            top,
            left,
            width: hatImage.naturalWidth,
            height: hatImage.naturalHeight,
            scaleX: factor,
            scaleY: factor,
            centeredScaling: true,
            cornerColor: '#0b3a42',
            cornerStrokeColor: '#fff',
            cornerStyle: 'circle',
            transparentCorners: false,
            rotatingPointOffset: 30,
        });

        instance.setControlsVisibility({
            bl: false,
            tr: false,
            tl: false,
            ml: false,
            mt: false,
        });

        instance.factor = factor;

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

let facefinder_classify_region = (r, c, s, pixels, ldim) => -1.0;

// const cascadeurl =
//     'https://raw.githubusercontent.com/nenadmarkus/pico/c2e81f9d23cc11d1a612fd21e4f9de0921a5d0d9/rnt/cascades/facefinder';
const cascadeurl = 'https://coding.net/u/lqs469/p/santa-cap/git/raw/master/lib/facefinder';

fetch(cascadeurl).then(response => {
    response.arrayBuffer().then(buffer => {
        const bytes = new Int8Array(buffer);
        facefinder_classify_region = pico.unpack_cascade(bytes);
        console.log('* cascade loaded');
    });
});
