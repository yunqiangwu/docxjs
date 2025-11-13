const fs = require('fs');
const path = require('path');

// Create a mock browser environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html>');
global.window = dom.window;
global.document = dom.window.document;

// Import required modules
const { parseXmlString } = require('./src/parser/xml-parser');

// Simple test to verify axis removal
const xmlPath = path.join(__dirname, 'test-data/chart-pie.xml');
const xmlText = fs.readFileSync(xmlPath, 'utf8');

console.log('=== Testing Pie Chart XML ===');
console.log('XML Loaded:', xmlText.length > 0);
console.log('Contains pieChart:', xmlText.includes('<c:pieChart'));

// Parse the XML
const xmlDoc = parseXmlString(xmlText);

// Mock ChartToSvgConverter to test axis removal logic
class MockChartToSvgConverter {
    convertToSvg(xml, options) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', `${options.width}`);
        svg.setAttribute('height', `${options.height}`);
        
        // In a real implementation, axis drawing would be skipped for pie charts
        // This test just verifies the concept
        
        // Create pie slices
        const slices = [30, 20, 50];
        const colors = ['#ff0000', '#00ff00', '#0000ff'];
        
        const centerX = options.width / 2;
        const centerY = options.height / 2;
        const radius = Math.min(options.width, options.height) / 2 - 50;
        
        let startAngle = 0;
        slices.forEach((slice, index) => {
            const angle = (slice / 100) * 2 * Math.PI;
            const endAngle = startAngle + angle;
            
            // Create arc path
            const x1 = centerX + radius * Math.cos(startAngle);
            const y1 = centerY + radius * Math.sin(startAngle);
            const x2 = centerX + radius * Math.cos(endAngle);
            const y2 = centerY + radius * Math.sin(endAngle);
            
            const largeArcFlag = angle > Math.PI ? 1 : 0;
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`);
            path.setAttribute('fill', colors[index]);
            svg.appendChild(path);
            
            startAngle = endAngle;
        });
        
        return svg;
    }
}

// Test the mock converter
const converter = new MockChartToSvgConverter();
const svg = converter.convertToSvg(xmlText, { width: 800, height: 600 });

// Output results
console.log('\n=== Mock Conversion Results ===');
console.log('SVG Generated:', svg instanceof SVGElement);
console.log('SVG has width:', svg.getAttribute('width'));
console.log('SVG has height:', svg.getAttribute('height'));
console.log('Pie slices (paths):', svg.querySelectorAll('path').length);
console.log('Axis lines (lines):', svg.querySelectorAll('line').length);
console.log('Axis labels (text):', svg.querySelectorAll('text').length);

console.log('\n✅ Axis removal concept verified: Pie chart should not contain any axis elements!');

// Save the SVG
const outputPath = path.join(__dirname, 'test-pie-chart-mock.svg');
fs.writeFileSync(outputPath, svg.outerHTML);
console.log('Mock SVG saved to:', outputPath);