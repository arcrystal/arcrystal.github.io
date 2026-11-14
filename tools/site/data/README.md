# Ice optical data

CIE 2019, CIE 1931 colour-matching functions (2° observer), https://doi.org/10.25039/CIE.DS.xvudnb9b

CIE 2019, standard illuminant D65, https://doi.org/10.25039/CIE.DS.hjfjmt59

Original CSVs from https://files.cie.co.at/Publications-datasets/ . Attribution: International Commission on Illumination (CIE), Vienna, Austria. These datasets are provided under CC BY-SA 4.0. The derived `ice-spectrum.bin` lookup is likewise CC BY-SA 4.0.

Regenerate the linear-light retarder integral using `node tools/site/ice_spectrum.mjs`. The builder compares 5 nm integration against 1 nm integration. No network is needed to build or test.
