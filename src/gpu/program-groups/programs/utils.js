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
 * utils.js
 * Utility shaders
 */

// Identity shader: no-operation
export const identity = (image) => require('../../shaders/utils/identity.glsl');

// Flip y-axis for output
export const flipY = (image) => require('../../shaders/utils/flip-y.glsl');

// Fill image with a constant
export const fill = (value) => require('../../shaders/utils/fill.glsl');

// Fill zero or more color components of the input image with a constant value
export const fillComponents = (image, pixelComponents, value) => require('../../shaders/utils/fill-components.glsl');

// Copy the src component of src to zero or more color components of a copy of dest
export const copyComponents = (dest, src, destComponents, srcComponentId) => require('../../shaders/utils/copy-components.glsl');

// Scan the entire image and find the minimum & maximum pixel intensity for each row and column
export const scanMinMax1D = (image, iterationNumber) => require('../../shaders/utils/scan-minmax1d.glsl');

// Scan the entire image and find the minimum & maximum pixel intensity
export const scanMinMax2D = (image, iterationNumber) => require('../../shaders/utils/scan-minmax2d.glsl');