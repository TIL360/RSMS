import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import userContext from '../context/UserContext';
import { useNavigate, useParams } from 'react-router-dom';

const FeeEdit = () => {
  const navigate = useNavigate();
  const { token } = useContext(userContext);
  const { idf } = useParams();
  const [feedetail, setFeeDetail] = useState({});

  useEffect(() => {
    const fetchFeeDetails = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/fee/edit/${idf}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.log('Fetched fee details:', response.data);
        setFeeDetail(response.data.data);
      } catch (error) {
        console.error('Error fetching fee details:', error);
        alert('Error fetching fee details.');
      }
    };
    fetchFeeDetails();
  }, [idf, token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFeeDetail((prevState) => ({ ...prevState, [name]: value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const updatedFields = {
      monthly_fee: feedetail.monthly_fee,
      arrears: feedetail.arrears,
      adm_fee: feedetail.adm_fee,
      adm_arrears: feedetail.adm_arrears,
      fine_fee: feedetail.fine_fee,
      fine_arrears: feedetail.fine_arrears,
      exam_fee: feedetail.exam_fee,
      exam_arrears: feedetail.exam_arrears,
      updated_at: new Date().toLocaleDateString('en-GB'), // dd-mm-yyyy format
    };
    try {
      const response = await axios.patch(`${process.env.REACT_APP_API_URL}/fee/edit/update/${idf}`, updatedFields, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log('Server response:', response);
      navigate('/dashboard/feesearch', { state: { message: 'Fee updated successfully!' } });
    } catch (error) {
      console.error('Error updating fee:', error);
      alert('Error updating fee.');
    }
  };
  const handleBack = () => {
    navigate("/dashboard/feesearch");
  };
  return (
    <>
      <div style={{ backgroundColor: "white" }} className="card col-md-8 mx-auto">
        <div className="row">
          <h1 className="text-center">Fee Edit</h1>
          <div className="col-md-4">
            <div className="form-group">
              <label className="form-label">Monthly Fee</label>
              <input className="form-control" type="text" name="monthly_fee" value={feedetail.monthly_fee_feetbl || 0} onChange={handleInputChange} />
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group">
              <label className="form-label">Arrears</label>
              <input className="form-control" type="text" name="arrears" value={feedetail.arrears || 0} onChange={handleInputChange} />
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group">
              <label className="form-label">Adm Fee</label>
              <input className="form-control" type="text" name="adm_fee" value={feedetail.adm_fee || 0} onChange={handleInputChange} />
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group">
              <label className="form-label">Adm Arrears</label>
              <input className="form-control" type="text" name="adm_arrears" value={feedetail.adm_arrears || 0} onChange={handleInputChange} />
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group">
              <label className="form-label">Fine Fee</label>
              <input className="form-control" type="text" name="fine_fee" value={feedetail.fine_fee || 0} onChange={handleInputChange} />
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group">
              <label className="form-label">Fine Arrears</label>
              <input className="form-control" type="text" name="fine_arrears" value={feedetail.fine_arrears || 0} onChange={handleInputChange} />
            </div>
          </div>
          <div className="col-md-4">
  <div className="form-group">
    <label className="form-label">Exam Fee</label>
    <input className="form-control" type="text" name="exam_fee" value={feedetail.exam_fee || 0} onChange={handleInputChange} />
  </div>
</div>
<div className="col-md-4">
  <div className="form-group">
    <label className="form-label">Exam Arrears</label>
    <input className="form-control" type="text" name="exam_arrears" value={feedetail.exam_arrears || 0} onChange={handleInputChange} />
  </div>
</div>
<div className="form-group">
</div>
</div>
<div className='row'>

<button className="btn btn-success col-md-2 ml-3" onClick={(e) => handleUpdate(e)}> Update </button>
<button className="btn btn-secondary ml-1 col-md-2" onClick={(e) => handleBack(e)}> Back </button>

</div>
</div>
</>
);
};

export default FeeEdit;