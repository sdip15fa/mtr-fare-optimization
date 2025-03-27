import csv
from collections import defaultdict
from itertools import permutations
import os
import statistics # Import the statistics module

# --- Configuration ---
CSV_FILE_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'mtr_lines_fares.csv')
PAYMENT_METHOD_TO_ANALYZE = 'OCT_ADT_FARE' # Change this to analyze other fare types
# ---

def load_fare_data(filepath):
    """Loads fare data from the CSV file."""
    fares = defaultdict(dict)
    stations = set()
    try:
        with open(filepath, mode='r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            # Check header row for expected columns
            expected_headers = ['SRC_STATION_ID', 'DEST_STATION_ID']
            if not all(h in reader.fieldnames for h in expected_headers):
                print(f"Error: CSV file is missing expected headers. Found: {reader.fieldnames}")
                return None, None

            for row in reader:
                try:
                    # Use the correct column names from the CSV
                    start_id = int(row['SRC_STATION_ID'])
                    dest_id = int(row['DEST_STATION_ID'])
                    stations.add(start_id)
                    stations.add(dest_id)
                    # Store fares for all payment methods found in the row
                    for key, value in row.items():
                        if 'FARE' in key: # Assuming fare columns contain 'FARE'
                            try:
                                # Handle potential empty strings or invalid numbers
                                fare_value = float(value) if value else None
                                if fare_value is not None:
                                     fares[(start_id, dest_id)][key] = fare_value
                            except ValueError:
                                fares[(start_id, dest_id)][key] = None # Mark invalid fare data
                except (ValueError, KeyError) as e:
                    print(f"Skipping row due to error: {e} - Row: {row}")
                    continue
    except FileNotFoundError:
        print(f"Error: CSV file not found at {filepath}")
        return None, None
    except Exception as e:
        print(f"An unexpected error occurred while reading the CSV: {e}")
        return None, None

    print(f"Loaded data for {len(stations)} unique stations.")
    return fares, sorted(list(stations))

def analyze_savings(fares, stations, payment_method):
    """Analyzes the fare data to find pairs with savings and calculate statistics."""
    if not fares or not stations:
        print("No fare data or stations loaded.")
        return 0

    saving_pairs_count = 0
    total_pairs_analyzed = 0
    savings_list = [] # List to store the saving amounts

    # Use permutations to get all unique ordered pairs (start, destination)
    for start_station, dest_station in permutations(stations, 2):
        total_pairs_analyzed += 1
        direct_fare_info = fares.get((start_station, dest_station), {})
        direct_fare = direct_fare_info.get(payment_method)

        # Skip if direct fare is missing or invalid for the chosen payment method
        if direct_fare is None:
            # print(f"Skipping {start_station} -> {dest_station}: Missing direct fare for {payment_method}")
            continue

        min_intermediate_fare = float('inf')
        optimal_intermediate_station = None

        # Iterate through all other stations as potential intermediate stops
        for intermediate_station in stations:
            if intermediate_station == start_station or intermediate_station == dest_station:
                continue

            # Get fare for the first leg
            fare1_info = fares.get((start_station, intermediate_station), {})
            fare1 = fare1_info.get(payment_method)

            # Get fare for the second leg
            fare2_info = fares.get((intermediate_station, dest_station), {})
            fare2 = fare2_info.get(payment_method)

            # Check if both legs have valid fares
            if fare1 is not None and fare2 is not None:
                total_intermediate_fare = fare1 + fare2
                # Check if this intermediate route is cheaper than the current minimum
                if total_intermediate_fare < min_intermediate_fare:
                    min_intermediate_fare = total_intermediate_fare
                    optimal_intermediate_station = intermediate_station # Keep track of the best intermediate stop

        # After checking all intermediates, see if the optimal one offers a saving
        if optimal_intermediate_station is not None and min_intermediate_fare < direct_fare:
            saving = direct_fare - min_intermediate_fare
            savings_list.append(saving)
            saving_pairs_count += 1
            # Optional: Print the optimal saving found for this pair
            # print(f"Optimal Saving: {start_station} -> {optimal_intermediate_station} -> {dest_station} (${min_intermediate_fare:.2f}) vs Direct (${direct_fare:.2f}). Saving: ${saving:.2f}")


        # Optional: Print progress
        # if total_pairs_analyzed % 500 == 0:
        #     print(f"Analyzed {total_pairs_analyzed} pairs...")

    print(f"\nAnalysis complete for payment method: {payment_method}")
    print(f"Total unique station pairs analyzed: {total_pairs_analyzed}")
    print(f"Number of station pairs with potential savings: {saving_pairs_count}")

    # Calculate and print statistics if savings were found
    if savings_list:
        min_saving = min(savings_list)
        max_saving = max(savings_list)
        avg_saving = statistics.mean(savings_list)
        median_saving = statistics.median(savings_list)

        print(f"Minimum Saving: ${min_saving:.2f}")
        print(f"Maximum Saving: ${max_saving:.2f}")
        print(f"Average Saving: ${avg_saving:.2f}")
        print(f"Median Saving: ${median_saving:.2f}")
    else:
        print("No savings found for any station pair.")

    return saving_pairs_count

if __name__ == "__main__":
    print(f"Analyzing MTR fare data from: {CSV_FILE_PATH}")
    print(f"Looking for savings using payment method: {PAYMENT_METHOD_TO_ANALYZE}")
    fare_data, station_list = load_fare_data(CSV_FILE_PATH)

    if fare_data and station_list:
        analyze_savings(fare_data, station_list, PAYMENT_METHOD_TO_ANALYZE)
    else:
        print("Failed to load data. Exiting.")
