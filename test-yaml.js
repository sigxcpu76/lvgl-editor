import { yamlEngine } from './src/utils/yaml.js';

const widgets = [
    {
        id: '1',
        type: 'page',
        name: 'main_page',
        x: 0,
        y: 0,
        width: 480,
        height: 480,
        styles: {},
        children: []
    }
];

const assets = [
    {
        id: 'font-1',
        name: 'roboto_20',
        type: 'font',
        family: 'Roboto',
        size: 20,
        source: 'gfonts://Roboto'
    }
];

const global_styles = {
    'my_style': {
        bg_color: '#FF0000',
        text_color: '#00FF00',
        text_font: 'roboto_20'
    }
};

const substitutions = {
    'project_name': 'Test Project'
};

const yaml = yamlEngine.generate(widgets, assets, global_styles, substitutions);
console.log("--- GENERATED YAML ---");
console.log(yaml);
console.log("----------------------");

if (yaml.includes('Test Project') && yaml.includes('roboto_20') && yaml.includes('my_style')) {
    console.log("SUCCESS: All elements found in generated YAML.");
} else {
    console.log("FAILURE: Missing elements in generated YAML.");
    process.exit(1);
}
