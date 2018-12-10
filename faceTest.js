var img = document.getElementById('image');
var ctx = document.getElementById('canvas').getContext('2d');

ctx.drawImage(img, 0, 0);
var rgba = ctx.getImageData(0, 0, 480, 360).data; // the size of the image is 480x360 (width x height)
// Next, we write a helper function that transforms an input RGBA array into grayscale:

function rgba_to_grayscale(rgba, nrows, ncols) {
    var gray = new Uint8Array(nrows * ncols);
    for (var r = 0; r < nrows; ++r)
        for (var c = 0; c < ncols; ++c)
            // gray = 0.2*red + 0.7*green + 0.1*blue
            gray[r * ncols + c] =
                (2 * rgba[r * 4 * ncols + 4 * c + 0] +
                    7 * rgba[r * 4 * ncols + 4 * c + 1] +
                    1 * rgba[r * 4 * ncols + 4 * c + 2]) /
                10;
    return gray;
}
// Now we are prepared to invoke the procedure that will run the facefinder_classify_region function across the image:

image = {
    pixels: rgba_to_grayscale(rgba, 360, 480),
    nrows: 360,
    ncols: 480,
    ldim: 480,
};
params = {
    shiftfactor: 0.1, // move the detection window by 10% of its size
    minsize: 20, // minimum size of a face
    maxsize: 1000, // maximum size of a face
    scalefactor: 1.1, // for multiscale processing: resize the detection window by 10% when moving to the higher scale
};
// run the cascade over the image
// dets is an array that contains (r, c, s, q) quadruplets
// (representing row, column, scale and detection score)
dets = pico.run_cascade(image, facefinder_classify_region, params);
// Notice that the minimum size of a face was set to $20$. This is unnecessarily small for most applications. Note that the processing speed heavily depends of this parameter. For real-time applications, you should set this value to, e.g., $100$. However, the set minimum size is appropriate for our example image.

// After the detection process finishes, the array dets contains quadruplets of the form$(r, c, s, q)$, where $r$, $c$ and $s$ specify the position (row, column) and size of face region, and $q$ represents the detection score. The higher the score of the region, the more likely it is a face.

// We can render the obtained detection results onto the canvas:

qthresh = 5.0;
for (i = 0; i < dets.length; ++i)
    // check the detection score
    // if it's above the threshold, draw it
    if (dets[i][3] > qthresh) {
        ctx.beginPath();
        ctx.arc(dets[i][1], dets[i][0], dets[i][2] / 2, 0, 2 * Math.PI, false);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'red';
        ctx.stroke();
    }
