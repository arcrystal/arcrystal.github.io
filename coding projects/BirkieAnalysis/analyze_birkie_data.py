import pandas as pd
import plotly.express as px
import dash
from dash import dcc, html
from dash.dependencies import Input, Output

# Load and clean data
df = pd.read_csv("birkie_data.csv").iloc[1:].reset_index(drop=True)
df["Bib"] = pd.to_numeric(df["Bib"], errors="coerce")
df["Age"] = pd.to_numeric(df["Age"], errors="coerce")
df["Ovr"] = pd.to_numeric(df["Ovr"], errors="coerce")
df["Time"] = pd.to_timedelta(df["Time"], errors="coerce")
df["Wave"] = (df["Bib"] // 1000).astype("Int64").astype(str)

df = df.dropna(subset=["Time", "Wave", "Age", "Ovr", "Sex", "Name"])  # Ensure valid data only

df["Time_seconds"] = df["Time"].dt.total_seconds()
df["Time_str"] = df["Time"].astype(str).str.split(" ").str[-1].str.split(".").str[0]

fixed_time_ticks = list(range(2 * 3600, 7 * 3600 + 1, 15 * 60))
fixed_time_labels = [f"{int(t // 3600)}:{int((t % 3600) // 60):02d}:00" for t in fixed_time_ticks]

def compute_expected_wave(overall_place):
    sorted_df = df.sort_values("Time_seconds")
    elite_men = sorted_df[sorted_df["Sex"] == "M"].head(200).index
    elite_women = sorted_df[sorted_df["Sex"] == "F"].head(65).index
    elite_indices = set(elite_men).union(set(elite_women))
    
    remaining_racers = sorted_df.drop(index=elite_indices)
    wave_sizes = df[df["Wave"].astype(int) <= 10]["Wave"].value_counts().sort_index().to_dict()
    sorted_waves = sorted(wave_sizes.keys(), key=lambda x: int(x))
    
    cumulative_places = 0
    for wave in sorted_waves:
        wave_size = wave_sizes[wave]
        if overall_place in elite_indices:
            return "0 (Elite Wave)"
        cumulative_places += wave_size
        if overall_place <= cumulative_places:
            return wave
    return sorted_waves[-1]

app = dash.Dash(__name__, suppress_callback_exceptions=True)

app.layout = html.Div([
    html.H1("Birkie Race Analysis", style={'textAlign': 'center', 'marginBottom': '30px'}),
    
    html.Div([
        html.Label("Select Wave:"),
        dcc.Dropdown(
            id="wave-filter",
            options=[{'label': f'Wave {w}', 'value': w} for w in sorted(df["Wave"].unique())],
            multi=True,
            placeholder="Select waves",
            style={'width': '100%'}
        ),
    ], style={'marginBottom': '20px'}),

    html.Div([
        html.Label("Select Age Range:"),
        dcc.RangeSlider(
            id="age-filter",
            min=int(df["Age"].min()),
            max=int(df["Age"].max()),
            step=1,
            marks={i: str(i) for i in range(int(df["Age"].min()), int(df["Age"].max())+1, 10)},
            value=[int(df["Age"].min()), int(df["Age"].max())],
        ),
    ], style={'marginBottom': '30px'}),
    
    html.Div([
        html.Label("Search Racer by Name or Bib:"),
        dcc.Input(id="racer-search", type="text", placeholder="Enter name or bib number"),
        html.Div(id="racer-info", style={'marginTop': '20px', 'fontSize': '16px'})
    ], style={'marginBottom': '30px'}),
    
    html.Div([
        html.Div([
            dcc.Graph(id="time-distribution", style={'width': '50%', 'height': '600px'}),
            dcc.Graph(id="time-line-plot", style={'width': '50%', 'height': '600px'})
        ], style={'display': 'flex', 'flexDirection': 'row', 'gap': '20px'}),
        
        html.Div([
            dcc.Graph(id="time-bucket-bar", style={'width': '100%', 'height': '600px'})
        ], style={'marginTop': '40px'}),
        
        dcc.Graph(id="age-time-trend", style={'width': '100%', 'height': '600px'})
    ], style={'display': 'flex', 'flexDirection': 'column', 'gap': '40px', 'height': 'auto', 'overflowY': 'auto'})
])

@app.callback(
    [Output("time-distribution", "figure"),
     Output("time-line-plot", "figure"),
     Output("time-bucket-bar", "figure"),
     Output("age-time-trend", "figure"),
     Output("racer-info", "children")],
    [Input("wave-filter", "value"),
     Input("age-filter", "value"),
     Input("racer-search", "value")]
)
def update_graphs(selected_waves, selected_age_range, query):
    filtered_df = df.copy()
    if selected_waves:
        filtered_df = filtered_df[filtered_df["Wave"].isin(selected_waves)]
    
    filtered_df = filtered_df[(filtered_df["Age"] >= selected_age_range[0]) & (filtered_df["Age"] <= selected_age_range[1])]
    
    fig1 = px.scatter(filtered_df, x="Wave", y="Time_seconds", title="Wave vs. Race Time", 
                      labels={"Wave": "Wave Number", "Time_seconds": "Finish Time (hh:mm:ss)"},
                      color="Wave", opacity=0.5, hover_data={"Time_str": True})
    fig1.update_yaxes(tickvals=fixed_time_ticks, ticktext=fixed_time_labels)
    
    filtered_df["Time_bin"] = pd.cut(filtered_df["Time_seconds"], bins=fixed_time_ticks, labels=fixed_time_labels[:-1], right=False)
    time_intervals = filtered_df.groupby(["Wave", "Time_bin"]).size().reset_index(name="Count")
    
    fig2 = px.line(time_intervals, x="Time_bin", y="Count", color="Wave", title="Race Time Line Distribution",
                   labels={"Time_bin": "Race Time (hh:mm:ss)"}, markers=True)
    
    fig3 = px.bar(time_intervals, x="Time_bin", y="Count", color="Wave",
                  title="Finishers by Time Intervals", labels={"Time_bin": "Race Time Interval"})
    
    fig4 = px.scatter(filtered_df, x="Time_seconds", y="Ovr", title="Overall place vs. Race Time", color="Wave", 
                        opacity=0.6, hover_data={"Time_str": True, "Time_seconds": False})
    fig4.update_layout(height=750)
    
    racer_info = "No racer found."
    if query and query.strip():
        query = str(query).lower()
        matches = df[df["Bib"].astype(str).str.contains(query, case=False) | df["Name"].str.lower().str.contains(query, case=False)].head(3)
        if not matches.empty:
            result_strings = []
            for _, racer in matches.iterrows():
                result_strings.append(f"Bib {racer['Bib']}: {racer['Name']}\n"
                                      f"- Age: {racer['Age']}\n"
                                      f"- Overall Place: {int(racer['Ovr'])}\n"
                                      f"- Pct back from leader: {((racer['Time_seconds'] - df['Time_seconds'].min()) / df['Time_seconds'].min()) * 100:.2f}%\n"
                                      f"- Wave: {racer['Wave']}\n"
                                      f"- Time: {racer['Time_str']}\n"
                                      f"- Place in Wave: {df[df['Wave'] == racer['Wave']].sort_values('Time_seconds').index.get_loc(racer.name) + 1}\n"
                                      f"- Pct back from wave leader: {((racer['Time_seconds'] - df[df['Wave'] == racer['Wave']]['Time_seconds'].min()) / df[df['Wave'] == racer['Wave']]['Time_seconds'].min()) * 100:.2f}%\n"
                                      f"- Expected Wave placement: {compute_expected_wave(racer['Ovr'])}")
            racer_info = html.Pre("\n\n".join(result_strings))

    return fig1, fig2, fig3, fig4, racer_info

if __name__ == "__main__":
    app.run_server(debug=True)
