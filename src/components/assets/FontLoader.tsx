import React, { useEffect } from 'react';
import { useStore } from '../../store';
import { loadGoogleFont } from './AssetManager';
import { resolveFontFamily } from '../../utils/fontUtils';

export const FontLoader: React.FC = () => {
    const assets = useStore(state => state.assets);

    useEffect(() => {
        const fontAssets = assets.filter(a => a.type === 'font');

        fontAssets.forEach(asset => {
            // Priority 1: Direct gfonts:// source
            if (asset.source?.startsWith('gfonts://')) {
                const family = asset.source.replace('gfonts://', '');
                loadGoogleFont(family);
            }
            // Priority 2: Use the family resolution logic
            else {
                const family = resolveFontFamily(asset.family || asset.name || asset.value);
                if (family && family !== 'inherit' && family !== 'monospace') {
                    loadGoogleFont(family);
                }
            }
        });
    }, [assets]);

    return null; // Side-effect only component
};
