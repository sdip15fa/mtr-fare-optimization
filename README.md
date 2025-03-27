# MTR Fare Optimization Calculator

This web application helps users find the cheapest way to travel on the Hong Kong MTR system by comparing the direct fare between two stations with potential two-leg journeys via intermediate stations.

## Features

*   **Station Selection:** Choose your start and destination MTR stations from an autocomplete dropdown.
*   **Payment Methods:** Select from various payment types (e.g., Adult Octopus, Student Octopus, Single Journey Ticket) to see the relevant fare.
*   **Fare Calculation:**
    *   Calculates the direct fare for the selected route and payment method.
    *   Identifies potentially cheaper routes by splitting the journey at an intermediate station.
*   **Results Display:** Shows the cheapest option found (highlighted) and the direct fare (if different and applicable), up to a maximum of 5 relevant options.
*   **Internationalization:** Supports English (EN) and Traditional Chinese (繁).
*   **Responsive Design:** Built with Material UI for usability across different screen sizes.

## Tech Stack

*   [React](https://reactjs.org/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Material UI](https://mui.com/)
*   [i18next](https://www.i18next.com/) / [react-i18next](https://react.i18next.com/)
*   [PapaParse](https://www.papaparse.com/) (for parsing CSV fare data)

## Data Source

The application uses MTR fare data stored in `public/mtr_lines_fares.csv`. *Note: The accuracy of calculations depends on the data in this file.*

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sdip15fa/mtr-fare-optimization.git
    cd mtr-fare-optimization
    ```
2.  **Install dependencies:**
    ```bash
    yarn install
    ```
3.  **Run the development server:**
    ```bash
    yarn start
    ```
    The application will be available at [http://localhost:3000](http://localhost:3000).

## Available Scripts

*   **`yarn start`**: Runs the app in development mode.
*   **`yarn build`**: Builds the app for production to the `build` folder.
*   **`yarn test`**: Launches the test runner in interactive watch mode.

## Attribution

*   **Icon:** [Savings icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/savings)
*   **Source Code:** [View on GitHub](https://github.com/sdip15fa/mtr-fare-optimization)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
