

// 定义图表配置接口
interface ChartConfig {
    width?: number;
    height?: number;
    padding?: number;
}

// 定义图表数据结构
interface ChartData {
    type: 'line' | 'bar' | 'pie' | 'area';
    series: {
        name: string;
        data: number[];
        color: string | string[];
    }[];
    categories: string[];
    title?: string;
    xAxis?: {
        title?: string;
    };
    yAxis?: {
        title?: string;
        min?: number;
        max?: number;
    };
}

export class ChartToSvgConverter {
    /**
     * 将chartXml转换为SVG元素
     * @param chartXml chartXml字符串
     * @param config 图表配置
     * @returns SVG元素
     */
    convertToSvg(chartXml: string, config: ChartConfig = {}): SVGSVGElement {
        try {
            // 确保在浏览器环境中运行
            if (typeof window === 'undefined') {
                throw new Error('Chart conversion requires a browser environment');
            }
            
            const parser = new (window as any).DOMParser();
            const xmlDoc = parser.parseFromString(chartXml, 'text/xml');
            const chartData = this.parseChartXml(xmlDoc);
            return this.generateSvg(chartData, config);
        } catch (error) {
            console.error('Chart XML parsing error:', error);
            return this.createErrorSvg(error.message || '无法解析图表数据');
        }
    }

    /**
     * 解析chartXml，提取图表数据
     * @param xmlDoc chartXml DOM对象
     * @returns 图表数据结构
     */
    private parseChartXml(xmlDoc: Document): ChartData {
        // 命名空间映射
        const ns = {
            c: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
            a: 'http://schemas.openxmlformats.org/drawingml/2006/main'
        };

        // 获取根元素
        const chartSpace = xmlDoc.getElementsByTagNameNS(ns.c, 'chartSpace')[0];
        const chart = chartSpace.getElementsByTagNameNS(ns.c, 'chart')[0];
        const plotArea = chart.getElementsByTagNameNS(ns.c, 'plotArea')[0];

        // 检测图表类型
        let chartType = '';
        if (plotArea.getElementsByTagNameNS(ns.c, 'lineChart').length > 0) {
            // 案例数据：../../test-data/chart-line.xml
            chartType = 'line';
        } else if (plotArea.getElementsByTagNameNS(ns.c, 'barChart').length > 0) {
            // 案例数据：../../test-data/chart-bar.xml
            chartType = 'bar';
        } else if (plotArea.getElementsByTagNameNS(ns.c, 'pieChart').length > 0) {
            // 案例数据：../../test-data/chart-pie.xml
            chartType = 'pie';
        } else if (plotArea.getElementsByTagNameNS(ns.c, 'areaChart').length > 0) {
            // 案例数据：../../test-data/chart-area.xml
            chartType = 'area';
        } else {
            // TODO: 其他图表类型
            throw new Error('不支持的图表类型');
        }

        // 提取标题
        const titleElement = chart.getElementsByTagNameNS(ns.c, 'title')[0];
        const title = titleElement ? this.extractText(titleElement, ns) : undefined;

        // 提取系列数据
        const series: ChartData['series'] = [];
        // 根据图表类型获取相应的图表元素
        const chartElement = plotArea.getElementsByTagNameNS(ns.c, `${chartType}Chart`)[0];
        const serElements = chartElement.getElementsByTagNameNS(ns.c, 'ser');

        for (let i = 0; i < serElements.length; i++) {
            const ser = serElements[i];
            const name = this.extractSeriesName(ser, ns);
            const data = this.extractSeriesData(ser, ns);
            let color: string | string[];
            
            // 饼图从dPt元素提取每个扇区的颜色
            if (chartType === 'pie') {
                color = [];
                const dPtElements = ser.getElementsByTagNameNS(ns.c, 'dPt');
                for (let j = 0; j < dPtElements.length; j++) {
                    const dPt = dPtElements[j];
                    const spPr = dPt.getElementsByTagNameNS(ns.c, 'spPr')[0];
                    if (spPr) {
                        const solidFill = spPr.getElementsByTagNameNS(ns.a, 'solidFill')[0];
                        if (solidFill) {
                            const schemeClr = solidFill.getElementsByTagNameNS(ns.a, 'schemeClr')[0];
                            if (schemeClr) {
                                const val = schemeClr.getAttribute('val');
                                const colorMap: Record<string, string> = {
                                    'accent1': '#1f77b4',
                                    'accent2': '#ff7f0e',
                                    'accent3': '#2ca02c',
                                    'accent4': '#d62728',
                                    'accent5': '#9467bd',
                                    'accent6': '#8c564b'
                                };
                                color.push(colorMap[val || ''] || '#1f77b4');
                            }
                        }
                    }
                }
                // 如果没有dPt颜色，使用默认颜色
                if (color.length === 0) {
                    color = data.map((_, idx) => this.extractSeriesColor(ser, ns, idx));
                }
            } else {
                // 其他图表类型使用系列颜色
                color = this.extractSeriesColor(ser, ns, i);
            }
            
            // 跳过空数据系列
            if (data.length > 0 && !name.includes('#REF!')) {
                series.push({ name, data, color });
            }
        }

        // 提取分类数据
        const categories = this.extractCategories(chartElement, ns);

        // 提取Y轴配置
        const valAx = plotArea.getElementsByTagNameNS(ns.c, 'valAx')[0];
        const yAxis = this.extractYAxisConfig(valAx, ns);

        return {
            type: chartType as 'line' | 'bar' | 'pie' | 'area',
            series,
            categories,
            title,
            yAxis
        };
    }

    /**
     * 提取系列名称
     * @param serElement 系列元素
     * @param ns 命名空间映射
     * @returns 系列名称
     */
    private extractSeriesName(serElement: Element, ns: Record<string, string>): string {
        const txElement = serElement.getElementsByTagNameNS(ns.c, 'tx')[0];
        if (!txElement) return `系列 ${serElement.getAttribute('idx')}`;

        const strRef = txElement.getElementsByTagNameNS(ns.c, 'strRef')[0];
        if (strRef) {
            const strCache = strRef.getElementsByTagNameNS(ns.c, 'strCache')[0];
            if (strCache) {
                const pt = strCache.getElementsByTagNameNS(ns.c, 'pt')[0];
                if (pt) {
                    const v = pt.getElementsByTagNameNS(ns.c, 'v')[0];
                    return v ? v.textContent || '' : '';
                }
            }
        }
        return `系列 ${serElement.getAttribute('idx')}`;
    }

    /**
     * 提取系列数据
     * @param serElement 系列元素
     * @param ns 命名空间映射
     * @returns 系列数据数组
     */
    private extractSeriesData(serElement: Element, ns: Record<string, string>): number[] {
        const valElement = serElement.getElementsByTagNameNS(ns.c, 'val')[0];
        if (!valElement) return [];

        const numRef = valElement.getElementsByTagNameNS(ns.c, 'numRef')[0];
        if (numRef) {
            const numCache = numRef.getElementsByTagNameNS(ns.c, 'numCache')[0];
            return this.extractNumericData(numCache, ns);
        }

        return [];
    }

    /**
     * 提取分类数据
     * @param chartElement 图表元素
     * @param ns 命名空间映射
     * @returns 分类数据数组
     */
    private extractCategories(chartElement: Element, ns: Record<string, string>): string[] {
        let catElement = chartElement.getElementsByTagNameNS(ns.c, 'cat')[0];
        
        // 如果图表元素没有直接的cat子元素（如面积图），则从第一个系列中提取
        if (!catElement) {
            const serElements = chartElement.getElementsByTagNameNS(ns.c, 'ser');
            if (serElements.length > 0) {
                const firstSer = serElements[0];
                catElement = firstSer.getElementsByTagNameNS(ns.c, 'cat')[0];
            }
        }
        
        // 确保catElement是一个Element对象
        if (!catElement || !(catElement instanceof Element)) {
            return [];
        }

        const numRef = catElement.getElementsByTagNameNS(ns.c, 'numRef')[0];
        if (numRef) {
            const numCache = numRef.getElementsByTagNameNS(ns.c, 'numCache')[0];
            return this.extractNumericData(numCache, ns).map(String);
        }

        const strRef = catElement.getElementsByTagNameNS(ns.c, 'strRef')[0];
        if (strRef) {
            const strCache = strRef.getElementsByTagNameNS(ns.c, 'strCache')[0];
            if (strCache) {
                const ptElements = strCache.getElementsByTagNameNS(ns.c, 'pt');
                const categories: string[] = [];
                for (let i = 0; i < ptElements.length; i++) {
                    const pt = ptElements[i];
                    const v = pt.getElementsByTagNameNS(ns.c, 'v')[0];
                    categories.push(v ? v.textContent || '' : '');
                }
                return categories;
            }
        }

        return [];
    }

    /**
     * 提取数值数据
     * @param cacheElement 缓存元素
     * @param ns 命名空间映射
     * @returns 数值数据数组
     */
    private extractNumericData(cacheElement: Element | null, ns: Record<string, string>): number[] {
        if (!cacheElement) return [];

        const ptElements = cacheElement.getElementsByTagNameNS(ns.c, 'pt');
        const data: number[] = [];

        for (let i = 0; i < ptElements.length; i++) {
            const pt = ptElements[i];
            const v = pt.getElementsByTagNameNS(ns.c, 'v')[0];
            if (v) {
                const textContent = v.textContent || '';
                const num = parseFloat(textContent);
                if (!isNaN(num)) {
                    data.push(num);
                }
            }
        }

        return data;
    }

    /**
     * 提取Y轴配置
     * @param valAxElement Y轴元素
     * @param ns 命名空间映射
     * @returns Y轴配置
     */
    private extractYAxisConfig(valAxElement: Element | null, ns: Record<string, string>): ChartData['yAxis'] | undefined {
        if (!valAxElement) return undefined;

        const scalingElement = valAxElement.getElementsByTagNameNS(ns.c, 'scaling')[0];
        let min: number | undefined;
        let max: number | undefined;

        if (scalingElement) {
            const minElement = scalingElement.getElementsByTagNameNS(ns.c, 'min')[0];
            const maxElement = scalingElement.getElementsByTagNameNS(ns.c, 'max')[0];
            if (minElement) {
                min = parseFloat(minElement.getAttribute('val') || '');
            }
            if (maxElement) {
                max = parseFloat(maxElement.getAttribute('val') || '');
            }
        }

        // 提取Y轴标题
        const txElement = valAxElement.getElementsByTagNameNS(ns.c, 'tx')[0];
        let title: string | undefined;
        if (txElement) {
            title = this.extractText(txElement, ns);
        }

        return {
            title,
            min,
            max
        };
    }

    /**
     * 提取文本内容
     * @param element 元素
     * @param ns 命名空间映射
     * @returns 文本内容
     */
    private extractText(element: Element, ns: Record<string, string>): string {
        const richElement = element.getElementsByTagNameNS(ns.c, 'rich')[0];
        if (richElement) {
            const bodyPr = richElement.getElementsByTagNameNS(ns.a, 'bodyPr')[0];
            const pElements = richElement.getElementsByTagNameNS(ns.a, 'p');
            let text = '';
            for (let i = 0; i < pElements.length; i++) {
                const rElements = pElements[i].getElementsByTagNameNS(ns.a, 'r');
                for (let j = 0; j < rElements.length; j++) {
                    const tElements = rElements[j].getElementsByTagNameNS(ns.a, 't');
                    for (let k = 0; k < tElements.length; k++) {
                        text += tElements[k].textContent || '';
                    }
                }
            }
            return text;
        }
        return '';
    }

    /**
     * 提取系列颜色
     * @param serElement 系列元素
     * @param ns 命名空间映射
     * @param index 系列索引
     * @returns 系列颜色
     */
    private extractSeriesColor(serElement: Element, ns: Record<string, string>, index: number): string {
        const spPrElement = serElement.getElementsByTagNameNS(ns.c, 'spPr')[0];
        if (!spPrElement) {
            // 使用默认颜色
            const defaultColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
            return defaultColors[index % defaultColors.length];
        }

        const lnElement = spPrElement.getElementsByTagNameNS(ns.a, 'ln')[0];
        if (lnElement) {
            const solidFill = lnElement.getElementsByTagNameNS(ns.a, 'solidFill')[0];
            if (solidFill) {
                const schemeClr = solidFill.getElementsByTagNameNS(ns.a, 'schemeClr')[0];
                if (schemeClr) {
                    const val = schemeClr.getAttribute('val');
                    // 映射主题颜色到实际颜色
                    const colorMap: Record<string, string> = {
                        'accent1': '#1f77b4',
                        'accent2': '#ff7f0e',
                        'accent3': '#2ca02c',
                        'accent4': '#d62728',
                        'accent5': '#9467bd',
                        'accent6': '#8c564b'
                    };
                    return colorMap[val || ''] || '#1f77b4';
                }
            }
        }

        return '#1f77b4';
    }

    /**
     * 生成SVG元素
     * @param chartData 图表数据结构
     * @param config 图表配置
     * @returns SVG元素
     */
    private generateSvg(chartData: ChartData, config: ChartConfig): SVGSVGElement {
        const { width = 800, height = 600, padding = 50 } = config;
        const svg = (window as any).document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', `${width}px`);
        svg.setAttribute('height', `${height}px`);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // 创建背景矩形
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('x', '0');
        background.setAttribute('y', '0');
        background.setAttribute('width', `${width}`);
        background.setAttribute('height', `${height}`);
        background.setAttribute('fill', 'white');
        svg.appendChild(background);

        // 绘制标题
        if (chartData.title) {
            this.drawTitle(svg, chartData.title, width, padding);
        }

        // 绘制图表区域
        const chartAreaWidth = width - padding * 2;
        const chartAreaHeight = height - padding * 2 - 50; // 减去标题高度
        const chartAreaX = padding;
        const chartAreaY = padding + 50;

        // 绘制坐标轴（饼图不需要坐标轴）
        if (chartData.type !== 'pie') {
            this.drawAxes(svg, chartData, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight, padding);
        }

        // 根据图表类型绘制图表
        switch (chartData.type) {
            case 'line':
                this.drawLineChart(svg, chartData, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight);
                break;
            case 'bar':
                this.drawBarChart(svg, chartData, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight);
                break;
            case 'pie':
                this.drawPieChart(svg, chartData, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight);
                break;
            case 'area':
                this.drawAreaChart(svg, chartData, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight);
                break;
        }

        return svg;
    }

    /**
     * 绘制标题
     * @param svg SVG元素
     * @param title 标题文本
     * @param width 图表宽度
     * @param padding 内边距
     */
    private drawTitle(svg: SVGSVGElement, title: string, width: number, padding: number): void {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', `${width / 2}`);
        text.setAttribute('y', `${padding + 30}`);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '16px');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#333333');
        text.textContent = title;
        svg.appendChild(text);
    }

    /**
     * 绘制坐标轴
     * @param svg SVG元素
     * @param chartData 图表数据结构
     * @param chartAreaX 图表区域X坐标
     * @param chartAreaY 图表区域Y坐标
     * @param chartAreaWidth 图表区域宽度
     * @param chartAreaHeight 图表区域高度
     * @param padding 内边距
     */
    private drawAxes(svg: SVGSVGElement, chartData: ChartData, chartAreaX: number, chartAreaY: number, chartAreaWidth: number, chartAreaHeight: number, padding: number): void {
        const { categories, yAxis } = chartData;

        // 绘制X轴
        const xAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        xAxisLine.setAttribute('x1', `${chartAreaX}`);
        xAxisLine.setAttribute('y1', `${chartAreaY + chartAreaHeight}`);
        xAxisLine.setAttribute('x2', `${chartAreaX + chartAreaWidth}`);
        xAxisLine.setAttribute('y2', `${chartAreaY + chartAreaHeight}`);
        xAxisLine.setAttribute('stroke', '#333333');
        xAxisLine.setAttribute('stroke-width', '1');
        svg.appendChild(xAxisLine);

        // 绘制X轴刻度和标签
        if (categories.length > 0) {
            const step = chartAreaWidth / categories.length;
            for (let i = 0; i < categories.length; i++) {
                const x = chartAreaX + step * (i + 0.5);

                // 绘制刻度线
                const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                tick.setAttribute('x1', `${x}`);
                tick.setAttribute('y1', `${chartAreaY + chartAreaHeight}`);
                tick.setAttribute('x2', `${x}`);
                tick.setAttribute('y2', `${chartAreaY + chartAreaHeight + 5}`);
                tick.setAttribute('stroke', '#333333');
                tick.setAttribute('stroke-width', '1');
                svg.appendChild(tick);

                // 绘制标签
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', `${x}`);
                label.setAttribute('y', `${chartAreaY + chartAreaHeight + 20}`);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('font-size', '12px');
                label.setAttribute('fill', '#333333');
                label.textContent = categories[i];
                svg.appendChild(label);
            }
        }

        // 绘制Y轴
        const yAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        yAxisLine.setAttribute('x1', `${chartAreaX}`);
        yAxisLine.setAttribute('y1', `${chartAreaY}`);
        yAxisLine.setAttribute('x2', `${chartAreaX}`);
        yAxisLine.setAttribute('y2', `${chartAreaY + chartAreaHeight}`);
        yAxisLine.setAttribute('stroke', '#333333');
        yAxisLine.setAttribute('stroke-width', '1');
        svg.appendChild(yAxisLine);

        // 计算Y轴刻度
        const allData = chartData.series.flatMap(series => series.data);
        const minY = yAxis?.min ?? Math.min(...allData);
        const maxY = yAxis?.max ?? Math.max(...allData);
        const yRange = maxY - minY;
        const tickCount = 5;
        const tickStep = yRange / (tickCount - 1);

        // 绘制Y轴刻度和标签
        for (let i = 0; i < tickCount; i++) {
            const y = chartAreaY + chartAreaHeight - (i / (tickCount - 1)) * chartAreaHeight;
            const value = minY + (i / (tickCount - 1)) * yRange;

            // 绘制刻度线
            const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('x1', `${chartAreaX - 5}`);
            tick.setAttribute('y1', `${y}`);
            tick.setAttribute('x2', `${chartAreaX}`);
            tick.setAttribute('y2', `${y}`);
            tick.setAttribute('stroke', '#333333');
            tick.setAttribute('stroke-width', '1');
            svg.appendChild(tick);

            // 绘制标签
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', `${chartAreaX - 10}`);
            label.setAttribute('y', `${y + 5}`);
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('font-size', '12px');
            label.setAttribute('fill', '#333333');
            label.textContent = value.toFixed(0);
            svg.appendChild(label);
        }
    }

    /**
     * 绘制折线图
     * @param svg SVG元素
     * @param chartData 图表数据结构
     * @param chartAreaX 图表区域X坐标
     * @param chartAreaY 图表区域Y坐标
     * @param chartAreaWidth 图表区域宽度
     * @param chartAreaHeight 图表区域高度
     */
    private drawLineChart(svg: SVGSVGElement, chartData: ChartData, chartAreaX: number, chartAreaY: number, chartAreaWidth: number, chartAreaHeight: number): void {
        const { series, categories, yAxis } = chartData;
        if (categories.length === 0 || series.length === 0) return;

        // 计算Y轴范围
        const allData = series.flatMap(series => series.data);
        const minY = yAxis?.min ?? Math.min(...allData);
        const maxY = yAxis?.max ?? Math.max(...allData);
        const yRange = maxY - minY || 1;

        // 计算X轴步长
        const step = chartAreaWidth / (categories.length - 1);

        series.forEach(series => {
            if (series.data.length === 0) return;

            // 创建路径数据
            let pathData = `M ${chartAreaX} ${chartAreaY + chartAreaHeight - ((series.data[0] - minY) / yRange) * chartAreaHeight}`;

            for (let i = 1; i < series.data.length; i++) {
                const x = chartAreaX + i * step;
                const y = chartAreaY + chartAreaHeight - ((series.data[i] - minY) / yRange) * chartAreaHeight;
                pathData += ` L ${x} ${y}`;
            }

            // 绘制折线
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            line.setAttribute('d', pathData);
            const lineColor = Array.isArray(series.color) ? series.color[0] : series.color;
            line.setAttribute('stroke', lineColor);
            line.setAttribute('stroke-width', '2');
            line.setAttribute('fill', 'none');
            line.setAttribute('stroke-linecap', 'round');
            svg.appendChild(line);

            // 绘制数据点
            series.data.forEach((dataPoint, i) => {
                const x = chartAreaX + i * step;
                const y = chartAreaY + chartAreaHeight - ((dataPoint - minY) / yRange) * chartAreaHeight;

                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', `${x}`);
                circle.setAttribute('cy', `${y}`);
                circle.setAttribute('r', '4');
                circle.setAttribute('fill', lineColor);
                circle.setAttribute('stroke', 'white');
                circle.setAttribute('stroke-width', '1');
                svg.appendChild(circle);
            });
        });
    }

    /**
     * 绘制柱状图
     * @param svg SVG元素
     * @param chartData 图表数据结构
     * @param chartAreaX 图表区域X坐标
     * @param chartAreaY 图表区域Y坐标
     * @param chartAreaWidth 图表区域宽度
     * @param chartAreaHeight 图表区域高度
     */
    private drawBarChart(svg: SVGSVGElement, chartData: ChartData, chartAreaX: number, chartAreaY: number, chartAreaWidth: number, chartAreaHeight: number): void {
        const { series, categories, yAxis } = chartData;
        if (categories.length === 0 || series.length === 0) return;

        // 计算Y轴范围
        const allData = series.flatMap(series => series.data);
        const minY = yAxis?.min ?? Math.min(...allData);
        const maxY = yAxis?.max ?? Math.max(...allData);
        const yRange = maxY - minY || 1;

        // 计算X轴布局
        const categoryCount = categories.length;
        const seriesCount = series.length;
        const step = chartAreaWidth / categoryCount;
        const barGroupWidth = step * 0.7; // 每组柱状图宽度占可用空间的70%
        const barWidth = barGroupWidth / seriesCount;
        const barSpacing = (step - barGroupWidth) / 2; // 每组两侧的间距

        categories.forEach((category, catIndex) => {
            const groupX = chartAreaX + catIndex * step + barSpacing;

            series.forEach((currentSeries, seriesIndex) => {
                const dataPoint = currentSeries.data[catIndex];
                if (typeof dataPoint !== 'number' || isNaN(dataPoint)) return;

                // 计算柱形位置和高度
                const normalizedValue = (dataPoint - minY) / yRange;
                const barHeight = normalizedValue * chartAreaHeight;
                const barX = groupX + seriesIndex * barWidth;
                const barY = chartAreaY + (chartAreaHeight - barHeight);

                // 绘制柱形
                const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bar.setAttribute('x', `${barX}`);
                bar.setAttribute('y', `${barY}`);
                bar.setAttribute('width', `${barWidth}`);
                bar.setAttribute('height', `${barHeight}`);
                const barColor = Array.isArray(currentSeries.color) ? currentSeries.color[catIndex] : currentSeries.color;
                bar.setAttribute('fill', barColor);
                bar.setAttribute('stroke', 'none');
                svg.appendChild(bar);

                // 绘制数据标签
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', `${barX + barWidth / 2}`);
                label.setAttribute('y', `${barY - 5}`);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('font-size', '12px');
                label.setAttribute('fill', '#333333');
                label.textContent = dataPoint.toFixed(0);
                svg.appendChild(label);
            });
        });
    }

    /**
     * 绘制饼图
     * @param svg SVG元素
     * @param chartData 图表数据结构
     * @param chartAreaX 图表区域X坐标
     * @param chartAreaY 图表区域Y坐标
     * @param chartAreaWidth 图表区域宽度
     * @param chartAreaHeight 图表区域高度
     */
    private drawPieChart(svg: SVGSVGElement, chartData: ChartData, chartAreaX: number, chartAreaY: number, chartAreaWidth: number, chartAreaHeight: number): void {
        const { series, categories } = chartData;
        if (series.length === 0 || series[0].data.length === 0) return;

        // 计算总数值
        const total = series[0].data.reduce((sum, value) => sum + value, 0);
        if (total === 0) return;

        // 计算饼图位置和大小
        const centerX = chartAreaX + chartAreaWidth / 2;
        const centerY = chartAreaY + chartAreaHeight / 2;
        const radius = Math.min(chartAreaWidth, chartAreaHeight) / 2 - 20;

        let startAngle = 0;

        // 绘制每个扇区
        series[0].data.forEach((value, index) => {
            const sliceAngle = (value / total) * 360;
            const endAngle = startAngle + sliceAngle;

            // 计算扇区路径
            const pathData = this.generatePieSlicePath(centerX, centerY, radius, startAngle, endAngle);

            // 绘制扇区
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            const sliceColor = Array.isArray(series[0].color) ? series[0].color[index] : series[0].color;
            path.setAttribute('fill', sliceColor);
            path.setAttribute('stroke', 'white');
            path.setAttribute('stroke-width', '1');
            svg.appendChild(path);

            // 绘制扇区标签
            if (categories[index]) {
                const labelAngle = startAngle + sliceAngle / 2;
                const labelX = centerX + Math.cos((labelAngle - 90) * Math.PI / 180) * (radius + 20);
                const labelY = centerY + Math.sin((labelAngle - 90) * Math.PI / 180) * (radius + 20);

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', `${labelX}`);
                text.setAttribute('y', `${labelY}`);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '12px');
                text.setAttribute('fill', '#333333');
                text.textContent = categories[index];
                svg.appendChild(text);
            }

            startAngle = endAngle;
        });
    }

    /**
     * 生成饼图扇区路径
     * @param centerX 中心X坐标
     * @param centerY 中心Y坐标
     * @param radius 半径
     * @param startAngle 起始角度
     * @param endAngle 结束角度
     * @returns 路径数据字符串
     */
    private generatePieSlicePath(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number): string {
        // 转换角度为弧度
        const startRad = (startAngle - 90) * Math.PI / 180;
        const endRad = (endAngle - 90) * Math.PI / 180;

        // 计算起始和结束点
        const startX = centerX + Math.cos(startRad) * radius;
        const startY = centerY + Math.sin(startRad) * radius;
        const endX = centerX + Math.cos(endRad) * radius;
        const endY = centerY + Math.sin(endRad) * radius;

        // 判断是否为完整圆形
        const largeArcFlag = endAngle - startAngle > 180 ? '1' : '0';

        // 构建路径数据
        return `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
    }

    /**
     * 绘制面积图
     * @param svg SVG元素
     * @param chartData 图表数据结构
     * @param chartAreaX 图表区域X坐标
     * @param chartAreaY 图表区域Y坐标
     * @param chartAreaWidth 图表区域宽度
     * @param chartAreaHeight 图表区域高度
     */
    private drawAreaChart(svg: SVGSVGElement, chartData: ChartData, chartAreaX: number, chartAreaY: number, chartAreaWidth: number, chartAreaHeight: number): void {
        const { series, categories, yAxis } = chartData;
        if (categories.length === 0 || series.length === 0) return;

        // 计算Y轴范围
        const allData = series.flatMap(series => series.data);
        const minY = yAxis?.min ?? Math.min(...allData);
        const maxY = yAxis?.max ?? Math.max(...allData);
        const yRange = maxY - minY || 1;

        // 计算X轴步长
        const step = chartAreaWidth / (categories.length - 1);

        series.forEach(series => {
            if (series.data.length === 0) return;

            // 创建路径数据（包括面积）
            let pathData = `M ${chartAreaX} ${chartAreaY + chartAreaHeight}`;

            for (let i = 0; i < series.data.length; i++) {
                const x = chartAreaX + i * step;
                const y = chartAreaY + chartAreaHeight - ((series.data[i] - minY) / yRange) * chartAreaHeight;
                pathData += ` L ${x} ${y}`;
            }

            // 关闭路径回到起点
            pathData += ` L ${chartAreaX + (series.data.length - 1) * step} ${chartAreaY + chartAreaHeight} Z`;

            // 绘制面积
            const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            areaPath.setAttribute('d', pathData);
            const areaColor = Array.isArray(series.color) ? series.color[0] : series.color;
            areaPath.setAttribute('fill', areaColor);
            areaPath.setAttribute('opacity', '0.3');
            svg.appendChild(areaPath);

            // 绘制折线（在面积之上）
            let linePathData = `M ${chartAreaX} ${chartAreaY + chartAreaHeight - ((series.data[0] - minY) / yRange) * chartAreaHeight}`;
            for (let i = 1; i < series.data.length; i++) {
                const x = chartAreaX + i * step;
                const y = chartAreaY + chartAreaHeight - ((series.data[i] - minY) / yRange) * chartAreaHeight;
                linePathData += ` L ${x} ${y}`;
            }

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            line.setAttribute('d', linePathData);
            line.setAttribute('stroke', areaColor);
            line.setAttribute('stroke-width', '2');
            line.setAttribute('fill', 'none');
            line.setAttribute('stroke-linecap', 'round');
            svg.appendChild(line);

            // 绘制数据点
            series.data.forEach((dataPoint, i) => {
                const x = chartAreaX + i * step;
                const y = chartAreaY + chartAreaHeight - ((dataPoint - minY) / yRange) * chartAreaHeight;

                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', `${x}`);
                circle.setAttribute('cy', `${y}`);
                circle.setAttribute('r', '4');
                circle.setAttribute('fill', areaColor);
                circle.setAttribute('stroke', 'white');
                circle.setAttribute('stroke-width', '1');
                svg.appendChild(circle);
            });
        });
    }

    /**
     * 创建错误提示SVG
     * @param errorMessage 错误信息
     * @returns SVG元素
     */
    private createErrorSvg(errorMessage: string): SVGSVGElement {
        const svg = (window as any).document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '800px');
        svg.setAttribute('height', '600px');
        svg.setAttribute('viewBox', '0 0 800 600');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // 创建背景
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('x', '0');
        background.setAttribute('y', '0');
        background.setAttribute('width', '800');
        background.setAttribute('height', '600');
        background.setAttribute('fill', '#ffffff');
        svg.appendChild(background);

        // 创建错误提示文本
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '400');
        text.setAttribute('y', '300');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '16px');
        text.setAttribute('fill', '#d62728');
        text.textContent = errorMessage;
        svg.appendChild(text);

        return svg;
    }
}
