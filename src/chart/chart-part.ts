import { Part } from '../common/part';
import { OpenXmlPackage } from '../common/open-xml-package';
import { DocumentParser } from '../document-parser';

export class ChartPart extends Part {
    private _documentParser: DocumentParser;

    constructor(pkg: OpenXmlPackage, path: string, parser: DocumentParser) {
        super(pkg, path);
        this._documentParser = parser;
    }

    chartData: Element;

    parseXml(root: Element) {
        // 暂时保存图表XML数据，稍后在渲染时使用
        this.chartData = root;
    }
}