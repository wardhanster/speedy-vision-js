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
 * gpu-pyramids.js
 * Image pyramids
 */

import { GPUProgramGroup } from '../gpu-program-group';
import { flipY } from './programs/utils';
import { convX, convY } from './programs/convolution';
import { upsample2, downsample2, upsample3, downsample3 } from './programs/pyramids';
import { mergeKeypoints, mergeKeypointsAtConsecutiveLevels, normalizeKeypoints } from './programs/pyramids';
import { setScale, scale, crop } from './programs/pyramids';

/**
 * GPUPyramids
 * Image pyramids
 */
export class GPUPyramids extends GPUProgramGroup
{
    /**
     * Class constructor
     * @param {SpeedyGPU} gpu
     * @param {number} width
     * @param {number} height
     */
    constructor(gpu, width, height)
    {
        super(gpu, width, height);
        this
            // initialize pyramid
            .declare('setBase', setScale(1.0, gpu.pyramidHeight, gpu.pyramidMaxScale))
 
            // pyramid operations
            .compose('reduce', '_smoothX', '_smoothY', '_downsample2', '_scale1/2')
            .compose('expand', '_upsample2', '_smoothX2', '_smoothY2', '_scale2')
           
            // intra-pyramid operations (between two pyramid levels)
            .compose('intraReduce', '_upsample2', '_smoothX2', '_smoothY2', '_downsample3/2', '_scale2/3')
            .compose('intraExpand', '_upsample3', '_smoothX3', '_smoothY3', '_downsample2/3', '_scale3/2')

            // Merge keypoints across multiple scales
            .declare('mergeKeypoints', mergeKeypoints)
            .declare('mergeKeypointsAtConsecutiveLevels', mergeKeypointsAtConsecutiveLevels)
            .declare('normalizeKeypoints', normalizeKeypoints)

            // Crop texture to width x height of the current pyramid level
            .declare('crop', crop)

            // kernels for debugging
            .declare('output', flipY, {
                ...this.program.hasTextureSize(this._width, this._height),
                ...this.program.displaysGraphics()
            })

            .declare('output2', flipY, {
                ...this.program.hasTextureSize(2 * this._width, 2 * this._height),
                ...this.program.displaysGraphics()
            })

            .declare('output3', flipY, {
                ...this.program.hasTextureSize(3 * this._width, 3 * this._height),
                ...this.program.displaysGraphics()
            })


            
            // separable kernels for gaussian smoothing
            // use [c, b, a, b, c] where a+2c = 2b and a+2b+2c = 1
            // pick a = 0.4 for gaussian approximation
            .declare('_smoothX', convX([
                0.05, 0.25, 0.4, 0.25, 0.05
            ]))
            .declare('_smoothY', convY([
                0.05, 0.25, 0.4, 0.25, 0.05
            ]))

            // smoothing for 2x image
            // same rules as above with sum(k) = 2
            .declare('_smoothX2', convX([
                0.1, 0.5, 0.8, 0.5, 0.1
            ]), this.program.hasTextureSize(2 * this._width, 2 * this._height))

            .declare('_smoothY2', convY([
                0.1, 0.5, 0.8, 0.5, 0.1
            ], 1.0 / 2.0), this.program.hasTextureSize(2 * this._width, 2 * this._height))

            // smoothing for 3x image
            // use [1-b, b, 1, b, 1-b], where 0 < b < 1
            .declare('_smoothX3', convX([
                0.2, 0.8, 1.0, 0.8, 0.2
            ]), this.program.hasTextureSize(3 * this._width, 3 * this._height))

            .declare('_smoothY3', convY([
                0.2, 0.8, 1.0, 0.8, 0.2
            ], 1.0 / 3.0), this.program.hasTextureSize(3 * this._width, 3 * this._height))

            // upsampling & downsampling
            .declare('_upsample2', upsample2,
                this.program.hasTextureSize(2 * this._width, 2 * this._height))

            .declare('_downsample2', downsample2,
                this.program.hasTextureSize((1 + this._width) / 2, (1 + this._height) / 2))

            .declare('_upsample3', upsample3,
                this.program.hasTextureSize(3 * this._width, 3 * this._height))

            .declare('_downsample3', downsample3,
                this.program.hasTextureSize((2 + this._width) / 3, (2 + this._height) / 3))

            .declare('_downsample2/3', downsample2,
                this.program.hasTextureSize(3 * this._width / 2, 3 * this._height / 2))

            .declare('_downsample3/2', downsample3,
                this.program.hasTextureSize(2 * this._width / 3, 2 * this._height / 3))

            // adjust the scale coefficients
            .declare('_scale2', scale(2.0, gpu.pyramidHeight, gpu.pyramidMaxScale),
                this.program.hasTextureSize(2 * this._width, 2 * this._height))

            .declare('_scale1/2', scale(0.5, gpu.pyramidHeight, gpu.pyramidMaxScale),
                this.program.hasTextureSize((1 + this._width) / 2, (1 + this._height) / 2))

            .declare('_scale3/2', scale(1.5, gpu.pyramidHeight, gpu.pyramidMaxScale),
                this.program.hasTextureSize(3 * this._width / 2, 3 * this._height / 2))

            .declare('_scale2/3', scale(2.0 / 3.0, gpu.pyramidHeight, gpu.pyramidMaxScale),
                this.program.hasTextureSize(2 * this._width / 3, 2 * this._height / 3))
        ;
    }
}