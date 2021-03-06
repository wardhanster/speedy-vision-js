/*
 * speedy-vision.js
 * GPU-accelerated Computer Vision for the web
 * Copyright 2020 Alexandre Martins <alemartf(at)gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * fast.js
 * FAST corner detection
 */

import { Utils } from '../../utils/utils';
import { GLUtils } from '../../gpu/gl-utils';

/**
 * FAST corner detection
 */
export class FAST
{
    /**
     * Run the FAST corner detection algorithm
     * @param {SpeedyGPU} gpu
     * @param {WebGLTexture} greyscale Greyscale image
     * @param {number} n FAST parameter: 9, 7 or 5
     * @param {object} settings
     * @returns {WebGLTexture} corners
     */
    static run(gpu, greyscale, n, settings)
    {
        // validate input
        Utils.assert(
            n == 9 || n == 7 || n == 5,
            `Not implemented: FAST-${n}`
        );

        // default settings
        if(!settings.hasOwnProperty('threshold'))
            settings.threshold = 10;

        // convert a sensitivity value in [0,1],
        // if it's defined, to a FAST threshold
        if(settings.hasOwnProperty('sensitivity'))
            settings.threshold = this._sensitivity2threshold(settings.sensitivity);
        else
            settings.threshold = this._normalizedThreshold(settings.threshold);

        // virtual table
        const vtable = this.run._vtable || (this.run._vtable = {
            5: gpu => gpu.keypoints.fast5,
            7: gpu => gpu.keypoints.fast7,
            9: gpu => gpu.keypoints.fast9,
        });

        // keypoint detection
        const fast = (vtable[n])(gpu);
        const corners = fast(greyscale, settings.threshold);
        return gpu.keypoints.nonmaxSuppression(corners);
    }

    /**
     * Sensitivity to threshold conversion
     * sensitivity in [0,1] -> pixel intensity threshold in [0,1]
     * performs a non-linear conversion (used for FAST)
     * @param {number} sensitivity
     * @returns {number} pixel intensity
     */
    static _sensitivity2threshold(sensitivity)
    {
        // the number of keypoints ideally increases linearly
        // as the sensitivity is increased
        sensitivity = Math.max(0, Math.min(sensitivity, 1));
        return 1 - Math.tanh(2.77 * sensitivity);
    }

    /**
     * Normalize a threshold
     * pixel threshold in [0,255] -> normalized threshold in [0,1]
     * @returns {number} clamped & normalized threshold
     */
    static _normalizedThreshold(threshold)
    {
        threshold = Math.max(0, Math.min(threshold, 255));
        return threshold / 255;
    }
}

/**
 * FAST corner detector augmented with scale & orientation
 */
export class FASTPlus extends FAST
{
     /**
     * Run the FAST corner detection algorithm
     * @param {SpeedyGPU} gpu
     * @param {WebGLTexture} greyscale Greyscale image
     * @param {number} n must be 9
     * @param {object} settings
     * @returns {WebGLTexture} corners
     */
    static run(gpu, greyscale, n, settings)
    {
        // validate input
        Utils.assert(
            n == 9,
            `Not implemented: FAST-${n}-plus`
        );

        // default settings
        if(!settings.hasOwnProperty('threshold'))
            settings.threshold = 10;
        if(!settings.hasOwnProperty('depth'))
            settings.depth = 3; // how many pyramid levels to check

        // convert a sensitivity value in [0,1],
        // if it's defined, to a FAST threshold
        if(settings.hasOwnProperty('sensitivity'))
            settings.threshold = this._sensitivity2threshold(settings.sensitivity);
        else
            settings.threshold = this._normalizedThreshold(settings.threshold);

        // prepare data
        const MIN_DEPTH = 1, MAX_DEPTH = gpu.pyramidHeight;
        const depth = Math.max(MIN_DEPTH, Math.min(+(settings.depth), MAX_DEPTH));
        const maxLod = depth - 1;
        const log2PyrMaxScale = Math.log2(gpu.pyramidMaxScale);
        const pyrMaxLevels = gpu.pyramidHeight;
        const orientationPatchRadius = 3;

        // select algorithm
        const multiscaleFast = gpu.keypoints.fast9pyr;

        // generate pyramid
        const pyramid = greyscale;
        GLUtils.generateMipmap(gpu.gl, pyramid);

        // keypoint detection
        const multiscaleCorners = multiscaleFast(pyramid, settings.threshold, 0, maxLod, log2PyrMaxScale, pyrMaxLevels, true);

        // non-maximum suppression
        const suppressed1 = gpu.keypoints.samescaleSuppression(multiscaleCorners, log2PyrMaxScale, pyrMaxLevels);
        const suppressed2 = gpu.keypoints.multiscaleSuppression(suppressed1, log2PyrMaxScale, pyrMaxLevels, true);

        // compute orientation
        const orientedCorners = gpu.keypoints.multiscaleOrientationViaCentroid(suppressed2, orientationPatchRadius, pyramid, log2PyrMaxScale, pyrMaxLevels);
        return orientedCorners;
    }
}