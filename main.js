const $ = id => document.getElementById(id);

const cvs = $('cvs');
const ctx = cvs.getContext('2d');
const img = $('img');
const screenWidth = Math.min(window.screen.width, 500);
const defaultHat = 'hat6';
let canvasFabric;
let hatInstance;

function onUpload() {
    const file = $('upload').files[0];
    const reader = new FileReader();
    if (file) {
        reader.readAsDataURL(file);
        reader.onload = function(e) {
            img.src = reader.result;
            img.onload = function() {
                cvs.width = img.width;
                cvs.height = img.height;
                cvs.style.display = 'block';
                ctx.drawImage(img, 0, 0, img.width, img.height);
                detectFace(ctx, img)(convertImg2Cvs)(getHat);
            };
        };
    } else {
        img.src = '';
    }
}

function convertImg2Cvs(img) {
    canvasFabric = new fabric.Canvas(cvs, {
        width: screenWidth,
        height: screenWidth,
        backgroundImage: new fabric.Image(img, {
            width: img.width,
            height: img.height,
        }),
    });

    $('hatsContainer').style.display = 'flex';

    // Hide upload input and show the button and tips
    $('uploadContainer').style.display = 'none';
    $('uploadText').style.display = 'none';
    $('upload').style.display = 'none';
    $('changeHat').style.display = 'block';
    $('exportBtn').style.display = 'block';
    $('tip').style.opacity = 1;

    return next => next($(defaultHat));
}

function onClickHat(e = window.event) {
    const hatClicked = e.target || e.srcElement;
    getHat(hatClicked);
}

function getHat(hatElement) {
    const hatImage = hatElement;

    // Add hat image into fabric
    if (hatInstance) {
        canvasFabric.remove(hatInstance);
    }
    hatInstance = new fabric.Image(hatImage, {
        top: 40,
        left: screenWidth / 3,
        width: hatImage.width,
        height: hatImage.height,
        cornerColor: '#0b3a42',
        cornerStrokeColor: '#fff',
        cornerStyle: 'circle',
        transparentCorners: false,
        rotatingPointOffset: 30,
    });
    hatInstance.setControlVisible('bl', false);
    hatInstance.setControlVisible('tr', false);
    hatInstance.setControlVisible('tl', false);
    hatInstance.setControlVisible('mr', false);
    hatInstance.setControlVisible('mt', false);
    canvasFabric.add(hatInstance);
}

function exportFunc() {
    const exportImage = $('export');

    document.getElementsByClassName('canvas-container')[0].style.display =
        'none';
    $('exportBtn').style.display = 'none';
    $('tip').innerHTML = '长按图片保存或分享';
    $('changeHat').style.display = 'none';
    cvs.style.display = 'none';

    exportImage.style.display = 'block';
    exportImage.src = canvasFabric.toDataURL({
        width: screenWidth,
        height: screenWidth,
    });
}

let facefinder_classify_region = (r, c, s, pixels, ldim) => -1.0;

// const cascadeurl =
//     'https://raw.githubusercontent.com/nenadmarkus/pico/c2e81f9d23cc11d1a612fd21e4f9de0921a5d0d9/rnt/cascades/facefinder';
const cascadeurl = './facefinder';
fetch(cascadeurl).then(response => {
    response.arrayBuffer().then(buffer => {
        const bytes = new Int8Array(buffer);
        facefinder_classify_region = pico.unpack_cascade(bytes);
        console.log('* cascade loaded');
    });
});

function detectFace(ctx, img) {
    function rgba_to_grayscale(rgba, nrows, ncols) {
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

    const { width, height } = img;
    console.log(width, height);

    // re-draw the image to clear previous results and get its RGBA pixel data
    // ctx.drawImage(img, 0, 0, width, height);
    const rgba = ctx.getImageData(0, 0, width, height).data;
    // prepare input to `run_cascade`
    image = {
        pixels: rgba_to_grayscale(rgba, width, height),
        nrows: height,
        ncols: width,
        ldim: width,
    };
    params = {
        shiftfactor: 0.1, // move the detection window by 10% of its size
        minsize: 20, // minimum size of a face (not suitable for real-time detection, set it to 100 in that case)
        maxsize: 1000, // maximum size of a face
        scalefactor: 1.1, // for multiscale processing: resize the detection window by 10% when moving to the higher scale
    };
    // run the cascade over the image
    // dets is an array that contains (r, c, s, q) quadruplets
    // (representing row, column, scale and detection score)
    let dets = pico.run_cascade(image, facefinder_classify_region, params);
    // cluster the obtained detections
    dets = pico.cluster_detections(dets, 0.2); // set IoU threshold to 0.2
    // draw results
    console.log(dets);
    const qthresh = 5.0; // this constant is empirical: other cascades might require a different one
    for (let i = 0; i < dets.length; ++i)
        // check the detection score
        // if it's above the threshold, draw it
        if (dets[i][3] > qthresh) {
            ctx.beginPath();
            ctx.arc(
                dets[i][1],
                dets[i][0],
                dets[i][2] / 2,
                0,
                2 * Math.PI,
                false
            );
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'red';
            ctx.stroke();
        }

    const detectedImage = new Image();
    detectedImage.width = width;
    detectedImage.height = height;
    detectedImage.src = cvs.toDataURL('image/png');
    return next => next(detectedImage);
}
