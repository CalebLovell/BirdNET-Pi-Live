import argparse
import datetime
import json
import os

from utils.helpers import get_settings, MODEL_PATH


def format_species_json(model, week, threshold, species):
    """Return range results without mixing progress text into stdout."""
    rows = []
    for probability, label in species:
        sci_name, separator, com_name = label.partition('_')
        rows.append({
            'sciName': sci_name,
            'comName': com_name if separator else sci_name,
            'probability': float(probability),
        })
    rows.sort(key=lambda row: row['probability'], reverse=True)
    return json.dumps({
        'model': model,
        'week': int(week),
        'threshold': float(threshold),
        'species': rows,
    })

if __name__ == '__main__':
    # Keep the model dependency out of module import so the JSON formatter can
    # be tested on development machines that do not carry TensorFlow Lite.
    from utils.models import MDataModel1, MDataModel2

    parser = argparse.ArgumentParser(
        description='Get list of species for a given location with BirdNET. Sorted by occurrence frequency.'
    )
    parser.add_argument('--threshold', type=float,
                        help='Occurrence frequency threshold. Defaults to the configured SF_THRESH.')
    parser.add_argument('--json', action='store_true',
                        help='Print a single machine-readable JSON document.')
    args = parser.parse_args()

    conf = get_settings(os.environ.get('BIRDNET_CONF', '/etc/birdnet/birdnet.conf'))
    lat = conf.getfloat('LATITUDE')
    lon = conf.getfloat('LONGITUDE')
    week = datetime.datetime.today().isocalendar()[1]
    threshold = args.threshold if args.threshold is not None else conf.getfloat('SF_THRESH')

    if not args.json:
        print(f'Getting species list for {lat}/{lon}, Week {week}...', flush=True)
    labels_path = os.path.join(os.environ.get('BIRDNET_MODEL_DIR', MODEL_PATH), 'labels.txt')
    with open(labels_path, 'r') as lfile:
        labels = [line.strip() for line in lfile]

    model = MDataModel1(threshold) if conf.getint('DATA_MODEL_VERSION') == 1 else MDataModel2(threshold)
    model.set_meta_data(lat, lon, week)
    species_list = model.get_species_list_details(labels)

    if args.json:
        print(format_species_json(conf.get('MODEL'), week, threshold, species_list))
    else:
        for species in species_list:
            print(f'{species[1]} - {species[0]:.4f}')

        print("""
The above species list describes all the species that the model will attempt to detect.
If you don't see a species you want detected on this list, decrease your threshold.

NOTE: no actual changes to your BirdNET-Pi species list were made by running this command.
To set your desired frequency threshold, do it through the BirdNET-Pi web interface (Tools -> Settings -> Model)
""")
