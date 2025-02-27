import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import userContext from '../context/UserContext';
import { useNavigate, useParams } from 'react-router-dom';

export default function FeeCollection() {
  const navigate = useNavigate();
  const { token, user } = useContext(userContext); // Get user context
  const { idf } = useParams();
  const [feedetail, setFeeDetail] = useState({
    monthly_fee: "",
    adm_fee: "",
    exam_fee: "",
    fine_fee: "",
    collection: "", // Ensure this is initialized
    adm_collection: "", // Ensure this is initialized
    fine_collection: "", // Ensure this is initialized
    exam_collection: "", // Ensure this is initialized
    // Add other fields as necessary
  });

  useEffect(() => {
    const fetchFeeDetails = async () => {
        try {
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/fee/collect/${idf}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            console.log("Fetched student data:", response.data);
            if (response.data.success && response.data.data.length > 0) {
                setFeeDetail(response.data.data[0]);
            } else {
                alert("No data found for the given admission number.");
            }
        } catch (error) {
            console.error("Error fetching student:", error);
            alert("Error fetching the student data.");
        }
    };

    fetchFeeDetails();
}, [idf, token]);

const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFeeDetail((prevState) => ({
        ...prevState,
        [name]: value,
    }));
};

const handleUpdate = async (e) => {
  e.preventDefault();
  // Get current date in dd-mm-yyyy format
  const currentDate = new Date();
  const formattedDate = `${String(currentDate.getDate()).padStart(2, '0')}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${currentDate.getFullYear()}`; // "dd-mm-yyyy"
  const dataToUpdate = {
    collection: feedetail.collection,
    adm_collection: feedetail.adm_collection,
    exam_collection: feedetail.exam_collection,
    fine_collection: feedetail.fine_collection,
    collection_by: user.username, // Add this line
    payment_at: formattedDate // Add this line
  };
  console.log("Data to update:", dataToUpdate);
  try {
    const response = await axios.patch(`${process.env.REACT_APP_API_URL}/fee/update/${idf}`, dataToUpdate, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log("Server response:", response);
    navigate('/dashboard/feesearch', { state: { message: 'Fee collected successfully!' } });
  } catch (error) {
    console.error("Error updating fee:", error);
    alert("Fee already collected against this invoice.");
  }
};
const handleBack = () => {
  navigate("/dashboard/feesearch");
};

  

  return (
    <>
      <div className="card col-md-12 mx-auto">
        <div style={{ backgroundColor: "white" }} className="row">
          <h1 className='text-center'>Fee Collection</h1>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Monthly Fee</label>
              <input className="form-control" type="text" disabled value={feedetail.monthly_fee || 0} />
            </div>
          </div>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Arrears</label>
              <input className="form-control" type="text" disabled value={feedetail.adm_arrears || 0} />
            </div>
          </div>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Collection</label>
              <input className="form-control" type="text" name="collection" value={feedetail.collection || 0} onChange={handleInputChange} />
            </div>
          </div>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Adm Fee</label>
              <input className="form-control" type="text" disabled value={feedetail.adm_fee || 0} />
            </div>
          </div>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Adm Arrears</label>
              <input className="form-control" type="text" disabled value={feedetail.adm_arrears || 0} />
            </div>
          </div>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Adm Collection</label>
              <input className="form-control" type="text" name="adm_collection" value={feedetail.adm_collection || 0} onChange={handleInputChange} />
            </div>
          </div>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Fine Fee</label>
              <input className="form-control" type="text" disabled value={feedetail.fine_fee || 0} />
            </div>
          </div>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Fine Arrears</label>
              <input className="form-control" disabled type="text" value={feedetail.fine_arrears || 0} />
            </div>
          </div>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Fine Collection</label>
              <input className="form-control" type="text" name="fine_collection" value={feedetail.fine_collection || 0} onChange={handleInputChange} />
            </div>
          </div>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Exam Fee</label>
              <input className="form-control" type="text" disabled value={feedetail.exam_fee || 0} />
            </div>
          </div>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Exam Arrears</label>
              <input className="form-control" type="text" disabled value={feedetail.exam_arrears || 0} />
            </div>
          </div>

          <div className='col-md-4'>
            <div className="form-group">
              <label className="form-label">Exam Collection</label>
              <input className="form-control" type="text" name="exam_collection" value={feedetail.exam_collection || 0} onChange={handleInputChange} />
            </div>
          </div>

        </div><br/>
      
        <div className='row'>
      <button className='btn btn-success col-md-2 ml-3' onClick={(e) => handleUpdate(e)}>Update</button>
      <button className="btn btn-secondary ml-1 col-md-2" onClick={(e) => handleBack(e)}> Back </button>

</div>
      </div>
    </>
  );
}
