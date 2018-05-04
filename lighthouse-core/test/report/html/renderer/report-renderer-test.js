/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-env mocha */

const assert = require('assert');
const fs = require('fs');
const jsdom = require('jsdom');
const Util = require('../../../../report/html/renderer/util.js');
const URL = require('../../../../lib/url-shim');
const DOM = require('../../../../report/html/renderer/dom.js');
const DetailsRenderer = require('../../../../report/html/renderer/details-renderer.js');
const ReportUIFeatures = require('../../../../report/html/renderer/report-ui-features.js');
const CategoryRenderer = require('../../../../report/html/renderer/category-renderer.js');
// lazy loaded because it depends on CategoryRenderer to be available globally
let PerformanceCategoryRenderer = null;
const CriticalRequestChainRenderer = require(
    '../../../../report/html/renderer/crc-details-renderer.js');
const ReportRenderer = require('../../../../report/html/renderer/report-renderer.js');
const sampleResults = require('../../../results/sample_v2.json');

const TIMESTAMP_REGEX = /\d+, \d{4}.*\d+:\d+/;
const TEMPLATE_FILE = fs.readFileSync(__dirname +
    '/../../../../report/html/templates.html', 'utf8');

describe('ReportRenderer', () => {
  let renderer;

  before(() => {
    global.URL = URL;
    global.Util = Util;
    global.ReportUIFeatures = ReportUIFeatures;
    global.CriticalRequestChainRenderer = CriticalRequestChainRenderer;
    global.DetailsRenderer = DetailsRenderer;
    global.CategoryRenderer = CategoryRenderer;
    if (!PerformanceCategoryRenderer) {
      PerformanceCategoryRenderer =
        require('../../../../report/html/renderer/performance-category-renderer.js');
    }
    global.PerformanceCategoryRenderer = PerformanceCategoryRenderer;

    // Stub out matchMedia for Node.
    global.matchMedia = function() {
      return {
        addListener: function() {},
      };
    };

    const document = jsdom.jsdom(TEMPLATE_FILE);
    global.self = document.defaultView;

    const dom = new DOM(document);
    const detailsRenderer = new DetailsRenderer(dom);
    const categoryRenderer = new CategoryRenderer(dom, detailsRenderer);
    renderer = new ReportRenderer(dom, categoryRenderer);
  });

  after(() => {
    global.self = undefined;
    global.URL = undefined;
    global.Util = undefined;
    global.ReportUIFeatures = undefined;
    global.matchMedia = undefined;
    global.CriticalRequestChainRenderer = undefined;
    global.DetailsRenderer = undefined;
    global.CategoryRenderer = undefined;
    global.PerformanceCategoryRenderer = undefined;
  });

  describe('renderReport', () => {
    it('should render a report', () => {
      const container = renderer._dom._document.body;
      const output = renderer.renderReport(sampleResults, container);
      assert.ok(container.contains(output), 'report appended to container');
      assert.ok(output.classList.contains('lh-container'));
      assert.ok(output.querySelector('.lh-header'), 'has a header');
      assert.ok(output.querySelector('.lh-report'), 'has report body');
      assert.equal(output.querySelectorAll('.lh-gauge').length,
          sampleResults.reportCategories.length * 2, 'renders category gauges');
    });

    it('renders additional reports by replacing the existing one', () => {
      const container = renderer._dom._document.body;
      const oldReport = renderer.renderReport(sampleResults, container);
      const newReport = renderer.renderReport(sampleResults, container);
      assert.ok(!container.contains(oldReport), 'old report was removed');
      assert.ok(container.contains(newReport), 'new report appended to container');
    });

    it('renders a header', () => {
      const header = renderer._renderReportHeader(sampleResults);
      assert.ok(header.querySelector('.lh-export'), 'contains export button');

      assert.ok(header.querySelector('.lh-config__timestamp').textContent.match(TIMESTAMP_REGEX),
          'formats the generated datetime');
      assert.equal(header.querySelector('.lh-metadata__url').textContent, sampleResults.finalUrl);
      const url = header.querySelector('.lh-metadata__url');
      assert.equal(url.textContent, sampleResults.finalUrl);
      assert.equal(url.href, sampleResults.finalUrl);

      const userAgent = header.querySelector('.lh-env__item__ua');
      assert.equal(userAgent.textContent, sampleResults.userAgent, 'user agent populated');

      // Check runtime settings were populated.
      const names = Array.from(header.querySelectorAll('.lh-env__name')).slice(1);
      const descriptions = header.querySelectorAll('.lh-env__description');
      sampleResults.runtimeConfig.environment.forEach((env, i) => {
        assert.equal(names[i].textContent, env.name);
        assert.equal(descriptions[i].textContent, env.description);
      });
    });

    it('should not mutate a report object', () => {
      const container = renderer._dom._document.body;
      const originalResults = JSON.parse(JSON.stringify(sampleResults));
      renderer.renderReport(sampleResults, container);
      assert.deepStrictEqual(sampleResults, originalResults);
    }).timeout(2000);

    it('renders a left nav', () => {
      const header = renderer._renderReportNav(sampleResults);
      const categoryCount = sampleResults.reportCategories.length;
      assert.equal(header.querySelectorAll('.lh-leftnav__item').length, categoryCount);

      const categories = header.querySelectorAll('.leftnav-item__category');
      const scores = header.querySelectorAll('.leftnav-item__score');
      sampleResults.reportCategories.forEach((cat, i) => {
        assert.equal(categories[i].textContent, cat.name);
        assert.equal(Number(scores[i].textContent), cat.score * 100);
      });
    });

    it('renders no warning section when no lighthouseRunWarnings occur', () => {
      const container = renderer._dom._document.body;
      const output = renderer.renderReport(sampleResults, container);
      assert.strictEqual(output.querySelector('.lh-run-warnings'), null);
    });

    it('renders a warning section', () => {
      const runWarnings = [
        'Less bad thing',
        'Really bad thing',
        'LH should maybe just retire now',
      ];
      const warningResults = Object.assign({}, sampleResults, {runWarnings});
      const container = renderer._dom._document.body;
      const output = renderer.renderReport(warningResults, container);

      const warningEls = output.querySelectorAll('.lh-run-warnings > ul > li');
      assert.strictEqual(warningEls.length, runWarnings.length);
      warningEls.forEach((warningEl, index) => {
        const warningText = warningEl.textContent;
        assert.strictEqual(warningText, runWarnings[index]);
      });
    });

    it('renders a footer', () => {
      const footer = renderer._renderReportFooter(sampleResults);
      const footerContent = footer.querySelector('.lh-footer').textContent;
      assert.ok(/Generated by Lighthouse \d/.test(footerContent), 'includes lh version');
      assert.ok(footerContent.match(TIMESTAMP_REGEX), 'includes timestamp');
    });
  });

  it('can set a custom templateContext', () => {
    assert.equal(renderer._templateContext, renderer._dom.document());

    const otherDocument = jsdom.jsdom(TEMPLATE_FILE);
    renderer.setTemplateContext(otherDocument);
    assert.equal(renderer._templateContext, otherDocument);
  });
});
