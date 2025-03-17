const mondayFetch = async (query,apiVersion="2024-01") => {
    const mondayResponse = await fetch (
        `https://api.monday.com/v2`,
        {
            cache: "no-cache",
            method: 'post',
            headers:{
                'Content-Type': 'application/json',
                'Authorization': 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjE3MjU1MTMxNiwidWlkIjozMDI3MzE5NCwiaWFkIjoiMjAyMi0wNy0yN1QyMzowMzowNC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6ODg0NzExMCwicmduIjoidXNlMSJ9.OsVnuCUSnm-FF21sjAND10cWEKN9-UIqIkNx6Rz8Bfo',
                // 'Authorization' : 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjE1NTQ3NzM5NCwidWlkIjoyMTc2MjYwNiwiaWFkIjoiMjAyMi0wNC0xMlQxMzo0NjozOS4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6ODg0NzExMCwicmduIjoidXNlMSJ9.mpXq7PtWbmneakwja8iB091bZFnElYif7Ji1IyBmmSA'
                'API-Version' : apiVersion
            },
            body: JSON.stringify({query})
        }
    );  
    return await mondayResponse.json();
}
