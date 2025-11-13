const { ChartToSvgConverter } = require('./dist/chart/chart-to-svg');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Create a mock browser environment
const dom = new JSDOM('<!DOCTYPE html>');

// Set up global window and document objects
global.window = dom.window;
global.document = dom.window.document;

// Read the test XML file
const xmlPath = path.join(__dirname, 'src/chart/test-data/chart-bar.xml');
const xmlText = fs.readFileSync(xmlPath, 'utf8');

console.log('=== Testing Chart XML Structure ===');
console.log('XML loaded successfully');
console.log('Root element:', xmlText.match(/<[a-z]+:/)?.[0]);
console.log('Contains barChart:', xmlText.includes('<c:barChart'));
console.log('Number of series:', (xmlText.match(/<c:ser>/g) || []).length);
console.log('Number of categories:', (xmlText.match(/<c:cat>/g) || []).length);

// Render the chart
console.log('\n=== Rendering Bar Chart ===');
try {
    const converter = new ChartToSvgConverter();
    const svg = converter.convertToSvg(xmlText, { width: 800, height: 600 });
    
    // Convert SVG to string for inspection
    const svgString = svg.outerHTML;
    
    // Write SVG to a file
    const outputPath = path.join(__dirname, 'test-bar-chart-output.svg');
    fs.writeFileSync(outputPath, svgString);
    
    console.log('✅ Chart rendered successfully');
    console.log('Output SVG:', outputPath);
    console.log('SVG width:', svg.getAttribute('width'));
    console.log('SVG height:', svg.getAttribute('height'));
    
    // Check SVG structure
    const bars = svg.querySelectorAll('rect');
    const axisLines = svg.querySelectorAll('line');
    const textLabels = svg.querySelectorAll('text');
    
    console.log('\n📊 SVG Analysis:');
    console.log('Total elements:', svg.childElementCount);
    console.log('Bars:', bars.length);
    console.log('Axis lines:', axisLines.length);
    console.log('Text labels:', textLabels.length);
    
    // Display sample bar data
    console.log('\n📈 Bar Details:');
    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        const x = bar.getAttribute('x');
        const y = bar.getAttribute('y');
        const width = bar.getAttribute('width');
        const height = bar.getAttribute('height');
        const fill = bar.getAttribute('fill');
        console.log(`Bar ${i + 1}: x=${x}, y=${y}, width=${width}, height=${height}, fill=${fill}`);
    }
    
    // Display categories
    console.log('\n🏷️  Categories:');
    const categories = [];
    for (let i = 0; i < textLabels.length; i++) {
        const label = textLabels[i];
        const y = label.getAttribute('y');
        if (y && parseInt(y) > 550) {
            categories.push(label.textContent || '');
        }
    }
    console.log('Categories:', categories);
    
    // Verify data
    const allBars = bars.length;
    const expectedBars = 12; // 4 categories × 3 series
    
    if (allBars === expectedBars) {
        console.log('\n✅ PASS: Expected number of bars (' + expectedBars + ') matched');
    } else {
        console.log('\n❌ FAIL: Expected ' + expectedBars + ' bars, got ' + allBars);
    }
    
    console.log('\n🎉 Test completed successfully!');
    
} catch (error) {
    console.error('❌ Error rendering chart:', error.message);
    console.error(error.stack);
}
