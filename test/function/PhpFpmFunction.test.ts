import { describe, expect, it } from 'vitest';
import { PhpFpmFunction } from '../../src';
import { cleanupTemplate, compileTestStack } from '../helper';
import {Architecture, LayerVersion} from 'aws-cdk-lib/aws-lambda';
import { mapValues } from 'lodash';

describe('PhpFpmFunction', () => {
    it('builds', () => {
        const template = compileTestStack((stack) => {
            new PhpFpmFunction(stack, 'Function');
        }).toJSON();

        expect(cleanupTemplate(template).Resources).toMatchSnapshot();
    });

    it('supports ARM', () => {
        const template = compileTestStack((stack) => {
            new PhpFpmFunction(stack, 'Function', {
                architecture: Architecture.ARM_64,
            });
        });

        mapValues(template.findResources('AWS::Lambda::Function'), (resource) => {
            expect(resource.Properties.Architectures).toEqual(['arm64']);
            expect(resource.Properties.Layers[0]).matches(
                /arn:aws:lambda:us-east-1:534081306603:layer:arm-php-81-fpm:\d+/
            );
        });
    });

    // https://github.com/brefphp/constructs/issues/1
    it('can build multiple functions in the same stack', () => {
        const template = compileTestStack((stack) => {
            new PhpFpmFunction(stack, 'Function1');
            new PhpFpmFunction(stack, 'Function2');
        });

        template.resourceCountIs('AWS::Lambda::Function', 2);
    });

    it('adds additional layer before php layer', () => {
        const template = compileTestStack((stack) => {
            new PhpFpmFunction(stack, 'Console', {
                handler: 'index.php',
                layers: [LayerVersion.fromLayerVersionArn(stack, 'Layer', 'arn:aws:lambda:us-east-1:123456789012:layer:layer-name:1')],
            });
        });

        const phpFunction = template.findResources('AWS::Lambda::Function');
        const layers = phpFunction.Console63CA37A7.Properties.Layers;
        expect(layers).length(2);
        expect(layers[1]).to.match(/arn:aws:lambda:us-east-1:534081306603:layer:php-81-fpm:\d+/);
        expect(layers[0]).to.match(/arn:aws:lambda:us-east-1:123456789012:layer:layer-name:1/);
    });
});
