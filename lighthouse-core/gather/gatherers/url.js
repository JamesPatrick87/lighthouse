/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Gatherer = require('./gatherer');

class URL extends Gatherer {
  /**
   * @param {LH.Gatherer.PassContext} passContext
   * @return {LH.Artifacts['URL']}
   */
  afterPass(passContext) {
    // Instead of the originally inputted URL (options.requestedUrl), we want the resolved
    // post-redirect URL (which is here at options.url)
    return {
      // @ts-ignore TODO(bckenny): fix url/requestedUrl on passContext
      requestedUrl: passContext.initialUrl,
      finalUrl: passContext.url,
    };
  }
}

module.exports = URL;
